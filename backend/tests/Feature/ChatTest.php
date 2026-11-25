<?php

namespace Tests\Feature;

use App\Events\ShopEvent;
use App\Models\Category;
use App\Models\ChatConversation;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\ChatAssistant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    private Product $peach;

    private Product $coffee;

    protected function setUp(): void
    {
        parent::setUp();
        Event::fake([ShopEvent::class]);
        $category = Category::create(['name' => 'Trà']);
        $this->peach = Product::create(['category_id' => $category->id, 'name' => 'Trà đào', 'description' => 'Trà đào cam sả thanh mát', 'featured' => true]);
        $this->peach->variants()->create(['size' => 'M', 'price' => 40000]);
        $this->coffee = Product::create(['category_id' => $category->id, 'name' => 'Cà phê muối', 'description' => 'Cà phê đậm vị', 'featured' => false]);
        $this->coffee->variants()->create(['size' => 'M', 'price' => 35000]);
        config(['services.gemini.key' => 'test-key', 'services.gemini.model' => 'model-a', 'services.gemini.fallback_models' => 'model-b']);
    }

    private function gemini(string $reply, array $ids): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => json_encode(['reply' => $reply, 'product_ids' => $ids])]]]]]];
    }

    /** Thân SSE của Gemini: JSON trả lời bị cắt thành nhiều đoạn, kể cả giữa ký tự thoát. */
    private function sse(string $reply, array $ids, int $pieces = 4): string
    {
        $json = json_encode(['reply' => $reply, 'product_ids' => $ids]);
        $size = (int) ceil(strlen($json) / $pieces);

        return collect(str_split($json, $size))
            ->map(fn ($part) => 'data: '.json_encode(['candidates' => [['content' => ['parts' => [['text' => $part]]]]]])."\r\n\r\n")
            ->implode('');
    }

    /** @return array<int, array{event: string, data: array}> */
    private function events(string $body): array
    {
        return collect(preg_split('/\n\n/', trim($body)))->map(function ($raw) {
            preg_match('/^event: (\w+)\ndata: (.*)$/s', $raw, $m);

            return ['event' => $m[1], 'data' => json_decode($m[2], true)];
        })->all();
    }

    public function test_chat_uses_gemini_returns_only_real_products_and_saves_conversation(): void
    {
        Http::fake(['*' => Http::response($this->gemini('Bạn thử Trà đào nhé!', [$this->peach->id, 9999]))]);
        $res = $this->postJson('/api/chat', ['message' => 'Trời nóng uống gì?'])
            ->assertOk()->assertJsonPath('source', 'gemini')->assertJsonPath('reply', 'Bạn thử Trà đào nhé!')
            ->assertJsonCount(1, 'products')->assertJsonPath('products.0.id', $this->peach->id);
        Http::assertSent(fn ($req) => $req->hasHeader('x-goog-api-key', 'test-key') && str_contains($req['systemInstruction']['parts'][0]['text'], 'Trà đào'));

        $conversation = ChatConversation::where('uuid', $res->json('conversation_id'))->firstOrFail();
        $this->assertNull($conversation->user_id);
        $this->assertSame('Trời nóng uống gì?', $conversation->title);
        $this->assertSame(2, $conversation->messages_count);
        $this->assertSame([$this->peach->id], $conversation->messages()->where('role', 'model')->first()->product_ids);
        $this->getJson('/api/chat/conversations/'.$conversation->uuid)->assertOk()
            ->assertJsonCount(2, 'messages')->assertJsonPath('messages.1.products.0.id', $this->peach->id);
    }

    public function test_follow_up_sends_history_kept_on_server(): void
    {
        Http::fake(['*' => Http::sequence()->push($this->gemini('Bạn thích vị gì?', []))->push($this->gemini('Thử Trà đào nhé', [$this->peach->id]))]);
        $id = $this->postJson('/api/chat', ['message' => 'Gợi ý món'])->json('conversation_id');
        $this->postJson('/api/chat', ['conversation_id' => $id, 'message' => 'Vị trái cây'])->assertOk()->assertJsonPath('conversation_id', $id);

        $contents = Http::recorded()[1][0]['contents'];
        $this->assertSame(['user', 'model', 'user'], array_column($contents, 'role'));
        $this->assertSame('Bạn thích vị gì?', $contents[1]['parts'][0]['text']);
        // Mã hội thoại do server sinh: mã lạ thì mở hội thoại mới chứ không dùng mã khách tự đặt.
        $unknown = (string) Str::uuid();
        $this->assertNotSame($unknown, $this->postJson('/api/chat', ['conversation_id' => $unknown, 'message' => 'xin chào'])->json('conversation_id'));
    }

    public function test_chat_tries_next_model_when_primary_is_overloaded(): void
    {
        Http::fake([
            '*models/model-a:*' => Http::response(['error' => ['message' => 'high demand']], 503),
            '*models/model-b:*' => Http::response($this->gemini('Thử Trà đào nhé', [$this->peach->id])),
        ]);
        $this->postJson('/api/chat', ['message' => 'Gợi ý món mát'])
            ->assertOk()->assertJsonPath('source', 'gemini')->assertJsonPath('products.0.id', $this->peach->id);
        Http::assertSentCount(2);
    }

    public function test_chat_does_not_retry_other_models_on_bad_key(): void
    {
        Http::fake(['*' => Http::response(['error' => ['message' => 'API key not valid']], 400)]);
        $this->postJson('/api/chat', ['message' => 'xin chào'])->assertOk()->assertJsonPath('source', 'fallback');
        Http::assertSentCount(1);
    }

    public function test_chat_falls_back_without_key_or_on_error(): void
    {
        config(['services.gemini.key' => null]);
        $this->postJson('/api/chat', ['message' => 'Có món nào vị đào không?'])
            ->assertOk()->assertJsonPath('source', 'fallback')->assertJsonPath('products.0.id', $this->peach->id);
        config(['services.gemini.key' => 'test-key']);
        Http::fake(['*' => Http::response('quota', 429)]);
        $this->postJson('/api/chat', ['message' => 'xin chào'])->assertOk()->assertJsonPath('source', 'fallback');
        $this->postJson('/api/chat', ['message' => '   '])->assertUnprocessable();
        $this->postJson('/api/chat', ['message' => str_repeat('a', 1001)])->assertUnprocessable();
    }

    public function test_stream_sends_reply_in_pieces_then_saved_message(): void
    {
        $reply = 'Chào bạn, thử "Trà đào" mát lạnh\nít ngọt nhé 🍑';
        Http::fake(['*' => Http::response($this->sse($reply, [$this->peach->id], 6), 200, ['Content-Type' => 'text/event-stream'])]);
        $res = $this->post('/api/chat/stream', ['message' => 'Trời nóng'], ['Accept' => 'text/event-stream'])->assertOk();
        $this->assertStringStartsWith('text/event-stream', $res->headers->get('Content-Type'));
        $this->assertSame('no', $res->headers->get('X-Accel-Buffering'));

        $events = $this->events($res->streamedContent());
        $this->assertSame('start', $events[0]['event']);
        $this->assertSame('done', end($events)['event']);
        $deltas = collect($events)->where('event', 'delta');
        $this->assertGreaterThan(1, $deltas->count(), 'Câu trả lời phải tới thành nhiều đoạn');
        $this->assertSame($reply, $deltas->pluck('data.text')->implode(''));
        $done = end($events)['data'];
        $this->assertSame($reply, $done['message']['text']);
        $this->assertSame('gemini', $done['message']['source']);
        $this->assertSame($this->peach->id, $done['message']['products'][0]['id']);
        Http::assertSent(fn ($req) => str_contains($req->url(), 'model-a:streamGenerateContent?alt=sse'));
        $this->assertSame(2, ChatConversation::where('uuid', $events[0]['data']['conversation_id'])->value('messages_count'));
    }

    public function test_stream_uses_next_model_then_fallback(): void
    {
        Http::fake([
            '*models/model-a:*' => Http::response(['error' => ['message' => 'high demand']], 503),
            '*models/model-b:*' => Http::response($this->sse('Thử Cà phê muối nhé', [$this->coffee->id]), 200),
        ]);
        $events = $this->events($this->post('/api/chat/stream', ['message' => 'Cần tỉnh táo'])->streamedContent());
        $this->assertSame('Thử Cà phê muối nhé', end($events)['data']['message']['text']);

        Http::fake(['*' => Http::response('quota', 429)]);
        $events = $this->events($this->post('/api/chat/stream', ['message' => 'Có món vị đào không'])->streamedContent());
        $this->assertSame(['start', 'delta', 'done'], array_column($events, 'event'));
        $this->assertSame('fallback', $events[2]['data']['message']['source']);
        $this->assertSame($events[1]['data']['text'], $events[2]['data']['message']['text']);
    }

    public function test_stream_validates_before_opening_stream(): void
    {
        $this->postJson('/api/chat/stream', [])->assertUnprocessable();
        $this->withToken('expired-token')->postJson('/api/chat/stream', ['message' => 'hi'])->assertUnauthorized();
    }

    public function test_partial_reply_reads_unfinished_json(): void
    {
        $this->assertSame('', ChatAssistant::partialReply('{"rep'));
        $this->assertSame('Chào b', ChatAssistant::partialReply('{"reply": "Chào b'));
        $this->assertSame('Câu "hay"', ChatAssistant::partialReply('{"reply":"Câu \"hay\"", "product_ids": [1'));
        // Dừng trước ký tự thoát chưa nhận đủ.
        $this->assertSame('a', ChatAssistant::partialReply('{"reply":"a\\'));
        $this->assertSame('a', ChatAssistant::partialReply('{"reply":"a\\u00'));
        $this->assertSame('aé', ChatAssistant::partialReply('{"reply":"a\\u00e9'));
    }

    public function test_personalizes_with_order_history_without_contact_details(): void
    {
        $user = User::factory()->create(['name' => 'Nguyễn Minh An', 'phone' => '0909999888', 'address' => '12 Lê Lợi']);
        foreach ([[$this->peach, 3, '30', '50'], [$this->coffee, 1, '100', '100'], [$this->peach, 2, '30', '50']] as $i => [$product, $quantity, $sugar, $ice]) {
            $variant = $product->variants()->first();
            $order = Order::create(['user_id' => $user->id, 'code' => 'ZT'.$i, 'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('a', 64), 'status' => 'completed', 'payment_method' => 'cod', 'total' => $variant->price * $quantity, 'subtotal' => $variant->price * $quantity, 'recipient' => 'An', 'phone' => '0909999888', 'address' => '12 Lê Lợi']);
            $order->items()->create(['product_variant_id' => $variant->id, 'product_id' => $product->id, 'name' => $product->name, 'size' => 'M', 'price' => $variant->price, 'quantity' => $quantity, 'sugar' => $sugar, 'ice' => $ice]);
        }
        Http::fake(['*' => Http::response($this->gemini('Chào An, gọi lại Trà đào nhé?', [$this->peach->id]))]);
        Sanctum::actingAs($user);
        $this->postJson('/api/chat', ['message' => 'Hôm nay uống gì?'])->assertOk();

        Http::assertSent(function ($req) use ($user) {
            $instruction = $req['systemInstruction']['parts'][0]['text'];

            return str_contains($instruction, 'Tên gọi: An.')
                && str_contains($instruction, 'Trà đào (id '.$this->peach->id.', 5 ly')
                && str_contains($instruction, '30% đường, ít đá')
                && ! str_contains($instruction, $user->email)
                && ! str_contains($instruction, '0909999888')
                && ! str_contains($instruction, 'Lê Lợi');
        });
        // Khách quen, AI nghỉ: gợi ý lại món hay gọi thay vì món nổi bật.
        config(['services.gemini.key' => null]);
        $this->postJson('/api/chat', ['message' => 'xin chào'])->assertJsonPath('source', 'fallback')->assertJsonPath('products.0.id', $this->peach->id);
    }

    public function test_conversations_belong_to_their_owner(): void
    {
        [$owner, $other] = User::factory()->count(2)->create();
        Http::fake(['*' => Http::response($this->gemini('Chào bạn', []))]);
        // Khách vãng lai chat rồi đăng nhập: hội thoại chuyển về tài khoản.
        $id = $this->postJson('/api/chat', ['message' => 'xin chào'])->json('conversation_id');
        Sanctum::actingAs($owner);
        $this->postJson('/api/chat', ['conversation_id' => $id, 'message' => 'tiếp nhé'])->assertOk();
        $this->assertSame($owner->id, ChatConversation::where('uuid', $id)->value('user_id'));
        $this->getJson('/api/chat/conversations')->assertOk()->assertJsonCount(1)->assertJsonPath('0.uuid', $id)->assertJsonPath('0.messages_count', 4);

        Sanctum::actingAs($other);
        $this->getJson('/api/chat/conversations/'.$id)->assertNotFound();
        $this->postJson('/api/chat', ['conversation_id' => $id, 'message' => 'đọc trộm'])->assertNotFound();
        $this->getJson('/api/chat/conversations')->assertOk()->assertJsonCount(0);
    }
}
