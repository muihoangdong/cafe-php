<?php

namespace App\Http\Controllers;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use App\Services\ChatAssistant;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Trợ lý gợi ý món. Lịch sử hội thoại nằm ở server: trình duyệt chỉ gửi câu hỏi mới và mã hội thoại,
 * nên khách không thể chèn câu trả lời "model" giả vào lời nhắc.
 */
class ChatController extends Controller
{
    /** Số tin gần nhất gửi kèm cho Gemini làm ngữ cảnh. */
    private const CONTEXT = 12;

    public function __construct(private ChatAssistant $assistant) {}

    public function chat(Request $r)
    {
        [$conversation, $history, $user, $question] = $this->start($r);
        $products = $this->assistant->products();
        $answer = $this->assistant->ask($history, $products, $user);
        $message = $this->finish($conversation, $answer, $question, $products, $user);

        return ['conversation_id' => $conversation->uuid, 'reply' => $message['text'], 'products' => $message['products'], 'source' => $message['source'], 'message' => $message];
    }

    /**
     * Server-Sent Events: "start" (mã hội thoại), nhiều "delta" (đoạn chữ mới), rồi "done" (tin hoàn chỉnh kèm món gợi ý).
     */
    public function stream(Request $r): StreamedResponse
    {
        // Kiểm tra dữ liệu và lưu câu hỏi trước khi mở stream, để lỗi 422/404 vẫn trả JSON bình thường.
        [$conversation, $history, $user, $question] = $this->start($r);

        return response()->stream(function () use ($conversation, $history, $user, $question) {
            // Khách đóng tab giữa chừng thì vẫn lưu câu trả lời để lần sau mở lại thấy đủ.
            ignore_user_abort(true);
            $send = function (string $event, array $data) {
                echo "event: {$event}\ndata: ".json_encode($data, JSON_UNESCAPED_UNICODE)."\n\n";
                if (ob_get_level() > 0) {
                    ob_flush();
                }
                flush();
            };
            $send('start', ['conversation_id' => $conversation->uuid]);
            $products = $this->assistant->products();
            $streamed = false;
            $answer = $this->assistant->stream($history, $products, $user, function (string $text) use ($send, &$streamed) {
                $streamed = true;
                $send('delta', ['text' => $text]);
            });
            $message = $this->finish($conversation, $answer, $question, $products, $user);
            if (! $streamed) {
                $send('delta', ['text' => $message['text']]);
            }
            $send('done', ['conversation_id' => $conversation->uuid, 'message' => $message]);
        }, 200, [
            'Content-Type' => 'text/event-stream; charset=utf-8',
            'Cache-Control' => 'no-cache, no-transform',
            // Tắt buffer của nginx để chữ tới trình duyệt ngay.
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /** Các hội thoại gần đây của khách đăng nhập. */
    public function conversations(Request $r)
    {
        return $r->user()->chatConversations()->where('messages_count', '>', 0)->latest('last_message_at')->limit(20)
            ->get(['uuid', 'title', 'messages_count', 'last_message_at', 'created_at']);
    }

    public function show(Request $r, string $uuid)
    {
        $conversation = ChatConversation::where('uuid', $uuid)->first();
        abort_unless($conversation && $conversation->visibleTo($this->viewer($r)), 404, 'Không tìm thấy hội thoại.');

        return $this->transcript($conversation);
    }

    /** @return array{ChatConversation, Collection, ?User, string} */
    private function start(Request $r): array
    {
        $data = $r->validate(['conversation_id' => 'nullable|uuid', 'message' => 'required|string|max:1000']);
        $question = trim($data['message']);
        abort_if($question === '', 422, 'Bạn nhập câu hỏi nhé.');
        $user = $this->viewer($r);
        $conversation = isset($data['conversation_id']) ? ChatConversation::where('uuid', $data['conversation_id'])->first() : null;
        abort_if($conversation && ! $conversation->visibleTo($user), 404, 'Không tìm thấy hội thoại.');
        if (! $conversation) {
            // Mã do server sinh: không dùng mã khách tự đặt.
            $conversation = ChatConversation::create(['uuid' => (string) Str::uuid(), 'user_id' => $user?->id, 'title' => Str::limit($question, 60)]);
        } elseif ($user && ! $conversation->user_id) {
            // Khách vãng lai đăng nhập giữa chừng: hội thoại chuyển về tài khoản.
            $conversation->update(['user_id' => $user->id]);
        }
        $this->append($conversation, ['role' => 'user', 'text' => $question]);
        $history = $conversation->messages()->latest('id')->limit(self::CONTEXT)->get(['role', 'text'])
            ->reverse()->values()->map(fn (ChatMessage $m) => ['role' => $m->role, 'text' => $m->text]);
        // Gemini cần hội thoại bắt đầu từ khách.
        while ($history->isNotEmpty() && $history->first()['role'] !== 'user') {
            $history->shift();
        }

        return [$conversation, $history, $user, $question];
    }

    private function finish(ChatConversation $conversation, ?array $answer, string $question, Collection $products, ?User $user): array
    {
        $source = 'gemini';
        if (! $answer) {
            $answer = $this->assistant->fallback($question, $products, $user);
            $source = 'fallback';
        }
        $ids = collect($answer['product_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()
            ->filter(fn ($id) => $products->contains('id', $id))->take(ChatAssistant::MAX_SUGGESTIONS)->values()->all();
        $text = Str::limit(trim((string) ($answer['reply'] ?? '')), 1500) ?: 'Zentea chưa hiểu ý bạn, bạn mô tả thêm khẩu vị nhé?';
        $message = $this->append($conversation, ['role' => 'model', 'text' => $text, 'product_ids' => $ids, 'source' => $source]);

        return $this->present($message, $products);
    }

    private function append(ChatConversation $conversation, array $attributes): ChatMessage
    {
        $message = $conversation->messages()->create($attributes);
        $conversation->increment('messages_count', 1, ['last_message_at' => now()]);

        return $message;
    }

    private function transcript(ChatConversation $conversation): array
    {
        $products = $this->assistant->products();

        return [
            'conversation_id' => $conversation->uuid,
            'title' => $conversation->title,
            'messages' => $conversation->messages()->latest('id')->limit(100)->get()->reverse()->values()->map(fn ($m) => $this->present($m, $products)),
        ];
    }

    /** Món gợi ý lấy theo thực đơn hiện tại: món đã ngừng bán không hiện lại. */
    private function present(ChatMessage $message, Collection $products): array
    {
        return [
            'id' => $message->id,
            'role' => $message->role,
            'text' => $message->text,
            'source' => $message->source,
            'created_at' => $message->created_at,
            'products' => collect($message->product_ids ?? [])->map(fn ($id) => $products->firstWhere('id', $id))->filter()->values(),
        ];
    }

    /** Route chat mở cho khách vãng lai nên tự đọc token, nếu có. */
    private function viewer(Request $r): ?User
    {
        $user = $r->user('sanctum');
        // Có gửi token mà token hết hạn: báo 401 để trình duyệt làm mới token rồi gửi lại, thay vì lặng lẽ coi là khách vãng lai.
        abort_if($r->bearerToken() && ! $user, 401, 'Phiên đăng nhập đã hết hạn.');
        abort_if($user?->is_blocked, 403, 'Tài khoản đã bị khóa.');

        return $user;
    }
}
