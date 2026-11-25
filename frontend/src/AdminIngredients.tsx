import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, message, money } from "./lib/api";
import { Empty, Loading, Pager } from "./components";
import { Modal } from "./Admin";
import type {
  Ingredient,
  IngredientImport,
  IngredientList,
  Page,
} from "./types";

const amount = (n: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(n);
const today = () => new Date().toLocaleDateString("en-CA");

/** Kho nguyên liệu và phiếu nhập hàng. */
export function AdminIngredients() {
  const [tab, setTab] = useState<"stock" | "imports">("stock");
  const { data } = useQuery({
    queryKey: ["admin", "ingredients", "summary"],
    queryFn: async () =>
      (await api.get<IngredientList>("/admin/ingredients")).data,
  });
  return (
    <div className="admin-content">
      <h1>Nguyên liệu</h1>
      {data && (
        <div className="stat-grid">
          <div className="stat-card">
            <span>Số nguyên liệu</span>
            <strong>{data.summary.total}</strong>
          </div>
          <div className="stat-card">
            <span>Sắp hết, cần nhập thêm</span>
            <strong className={data.summary.low ? "text-warn" : ""}>
              {data.summary.low}
            </strong>
          </div>
          <div className="stat-card">
            <span>Chi phí nhập tháng này</span>
            <strong>{money(data.summary.month_cost)}</strong>
          </div>
        </div>
      )}
      <div className="tabs">
        <button
          className={tab === "stock" ? "selected" : ""}
          onClick={() => setTab("stock")}
        >
          Kho nguyên liệu
        </button>
        <button
          className={tab === "imports" ? "selected" : ""}
          onClick={() => setTab("imports")}
        >
          Phiếu nhập
        </button>
      </div>
      {tab === "stock" ? <Stock /> : <Imports />}
    </div>
  );
}

function Stock() {
  const client = useQueryClient();
  const [lowOnly, setLowOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Ingredient | null | undefined>();
  const [busy, setBusy] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ["admin", "ingredients", search, lowOnly],
    queryFn: async () =>
      (
        await api.get<IngredientList>("/admin/ingredients", {
          params: { search: search || undefined, low: lowOnly ? 1 : undefined },
        })
      ).data,
  });
  const refresh = () =>
    void client.invalidateQueries({ queryKey: ["admin", "ingredients"] });
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      await api.request({
        method: edit ? "put" : "post",
        url: "/admin/ingredients" + (edit ? "/" + edit.id : ""),
        data: {
          name: f.get("name"),
          unit: f.get("unit"),
          stock: Number(f.get("stock")),
          min_stock: Number(f.get("min_stock")),
          active: f.get("active") === "on",
        },
      });
      setEdit(undefined);
      refresh();
      toast.success("Đã lưu nguyên liệu");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(i: Ingredient) {
    if (
      !confirm(
        "Xóa " +
          i.name +
          "? Nếu đã có phiếu nhập, nguyên liệu chỉ chuyển sang ngừng dùng để giữ lịch sử.",
      )
    )
      return;
    try {
      await api.delete("/admin/ingredients/" + i.id);
      refresh();
    } catch (e) {
      toast.error(message(e));
    }
  }
  return (
    <>
      <div className="section-title">
        <div className="button-row">
          <input
            placeholder="Tìm nguyên liệu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
            />
            Chỉ nguyên liệu sắp hết
          </label>
        </div>
        <button className="btn" onClick={() => setEdit(null)}>
          <Plus size={18} /> Thêm nguyên liệu
        </button>
      </div>
      {isPending ? (
        <Loading />
      ) : data?.data.length ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nguyên liệu</th>
                <th>Tồn kho</th>
                <th>Mức cảnh báo</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map((i) => (
                <tr key={i.id}>
                  <td>{i.name}</td>
                  <td>
                    {amount(i.stock)} {i.unit}
                  </td>
                  <td>
                    {amount(i.min_stock)} {i.unit}
                  </td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (!i.active
                          ? "cancelled"
                          : i.low
                            ? "pending"
                            : "completed")
                      }
                    >
                      {!i.active ? "Ngừng dùng" : i.low ? "Sắp hết" : "Đủ dùng"}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => setEdit(i)}>Sửa</button>{" "}
                    <button className="danger" onClick={() => remove(i)}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>
          {lowOnly
            ? "Không có nguyên liệu nào sắp hết."
            : "Chưa có nguyên liệu."}
        </Empty>
      )}
      {edit !== undefined && data && (
        <Modal
          title={edit ? "Sửa nguyên liệu" : "Thêm nguyên liệu"}
          onClose={() => setEdit(undefined)}
        >
          <form className="form-grid" onSubmit={save}>
            <label>
              Tên nguyên liệu
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={edit?.name}
              />
            </label>
            <label>
              Đơn vị
              <select name="unit" defaultValue={edit?.unit ?? "kg"}>
                {data.units.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label>
              Tồn kho hiện tại
              <input
                name="stock"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={edit?.stock ?? 0}
              />
              <small className="muted">
                Chỉ sửa khi kiểm kê. Nhập hàng thì tạo phiếu nhập để có lịch sử
                chi phí.
              </small>
            </label>
            <label>
              Cảnh báo khi tồn còn
              <input
                name="min_stock"
                type="number"
                min={0}
                step="0.01"
                required
                defaultValue={edit?.min_stock ?? 0}
              />
            </label>
            <label className="check">
              <input
                name="active"
                type="checkbox"
                defaultChecked={edit?.active ?? true}
              />{" "}
              Đang dùng
            </label>
            <button className="btn" disabled={busy}>
              Lưu nguyên liệu
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

interface Row {
  key: number;
  ingredient_id: string;
  quantity: string;
  unit_price: string;
}
const emptyRow = (): Row => ({
  key: Math.random(),
  ingredient_id: "",
  quantity: "",
  unit_price: "",
});

function Imports() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<IngredientImport | null>(null);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [busy, setBusy] = useState(false);
  const { data, isPending } = useQuery({
    queryKey: ["admin", "ingredient-imports", page, search],
    queryFn: async () =>
      (
        await api.get<Page<IngredientImport>>("/admin/ingredient-imports", {
          params: { page, search: search || undefined },
        })
      ).data,
  });
  const ingredients = useQuery({
    queryKey: ["admin", "ingredients", "", false],
    queryFn: async () =>
      (await api.get<IngredientList>("/admin/ingredients")).data,
    enabled: creating,
  });
  const usable = ingredients.data?.data.filter((i) => i.active) || [];
  const lineTotal = (r: Row) =>
    Math.round(Number(r.quantity || 0) * Number(r.unit_price || 0));
  const total = rows.reduce((n, r) => n + lineTotal(r), 0);
  function change(key: number, patch: Partial<Row>) {
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function open() {
    setRows([emptyRow()]);
    setCreating(true);
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      await api.post("/admin/ingredient-imports", {
        supplier: f.get("supplier") || null,
        imported_at: f.get("imported_at") || null,
        note: f.get("note") || null,
        items: rows.map((r) => ({
          ingredient_id: Number(r.ingredient_id),
          quantity: Number(r.quantity),
          unit_price: Number(r.unit_price),
        })),
      });
      setCreating(false);
      void client.invalidateQueries({ queryKey: ["admin", "ingredients"] });
      void client.invalidateQueries({
        queryKey: ["admin", "ingredient-imports"],
      });
      toast.success("Đã nhập kho");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-title">
        <input
          placeholder="Tìm mã phiếu, nhà cung cấp…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <button className="btn" onClick={open}>
          <Plus size={18} /> Tạo phiếu nhập
        </button>
      </div>
      {isPending ? (
        <Loading />
      ) : data?.data.length ? (
        <section className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Ngày nhập</th>
                <th>Nhà cung cấp</th>
                <th>Nguyên liệu</th>
                <th>Tổng tiền</th>
                <th>Người nhập</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map((p) => (
                <tr key={p.id}>
                  <td>{p.code}</td>
                  <td>{new Date(p.imported_at).toLocaleDateString("vi-VN")}</td>
                  <td>{p.supplier || "–"}</td>
                  <td>{p.items.map((i) => i.ingredient.name).join(", ")}</td>
                  <td>{money(p.total)}</td>
                  <td>{p.user?.name || "–"}</td>
                  <td>
                    <button onClick={() => setDetail(p)}>Xem</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} last={data.last_page || 1} onChange={setPage} />
        </section>
      ) : (
        <Empty>Chưa có phiếu nhập.</Empty>
      )}
      {creating && (
        <Modal title="Tạo phiếu nhập" onClose={() => setCreating(false)}>
          <form className="form-grid import-form" onSubmit={save}>
            <label>
              Nhà cung cấp
              <input name="supplier" maxLength={150} />
            </label>
            <label>
              Ngày nhập
              <input
                name="imported_at"
                type="date"
                max={today()}
                defaultValue={today()}
              />
            </label>
            <div className="import-rows">
              <div className="import-row import-head">
                <span>Nguyên liệu</span>
                <span>Số lượng</span>
                <span>Đơn giá (đ)</span>
                <span>Thành tiền</span>
                <span />
              </div>
              {rows.map((r) => {
                const unit = usable.find(
                  (i) => String(i.id) === r.ingredient_id,
                )?.unit;
                return (
                  <div className="import-row" key={r.key}>
                    <select
                      required
                      aria-label="Nguyên liệu"
                      value={r.ingredient_id}
                      onChange={(e) =>
                        change(r.key, { ingredient_id: e.target.value })
                      }
                    >
                      <option value="">Chọn…</option>
                      {usable.map((i) => (
                        <option
                          key={i.id}
                          value={i.id}
                          disabled={rows.some(
                            (o) =>
                              o.key !== r.key &&
                              o.ingredient_id === String(i.id),
                          )}
                        >
                          {i.name} ({i.unit})
                        </option>
                      ))}
                    </select>
                    <input
                      required
                      aria-label="Số lượng"
                      type="number"
                      min={0.01}
                      step="0.01"
                      placeholder={unit}
                      value={r.quantity}
                      onChange={(e) =>
                        change(r.key, { quantity: e.target.value })
                      }
                    />
                    <input
                      required
                      aria-label="Đơn giá"
                      type="number"
                      min={0}
                      step={500}
                      placeholder={unit ? "đ/" + unit : ""}
                      value={r.unit_price}
                      onChange={(e) =>
                        change(r.key, { unit_price: e.target.value })
                      }
                    />
                    <strong>{money(lineTotal(r))}</strong>
                    <button
                      type="button"
                      aria-label="Bỏ dòng"
                      disabled={rows.length === 1}
                      onClick={() =>
                        setRows((all) => all.filter((o) => o.key !== r.key))
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                className="btn light"
                disabled={rows.length >= Math.min(50, usable.length)}
                onClick={() => setRows((all) => [...all, emptyRow()])}
              >
                <Plus size={16} /> Thêm dòng
              </button>
            </div>
            <label>
              Ghi chú
              <textarea name="note" maxLength={1000} rows={2} />
            </label>
            <div className="row-between">
              <span>Tổng tiền</span>
              <strong>{money(total)}</strong>
            </div>
            <button className="btn" disabled={busy}>
              Lưu phiếu và cộng kho
            </button>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal
          title={"Phiếu nhập " + detail.code}
          onClose={() => setDetail(null)}
        >
          <p>
            {new Date(detail.imported_at).toLocaleDateString("vi-VN")} ·{" "}
            {detail.supplier || "Không ghi nhà cung cấp"} · Người nhập:{" "}
            {detail.user?.name || "–"}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nguyên liệu</th>
                  <th>Số lượng</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.ingredient.name}</td>
                    <td>
                      {amount(i.quantity)} {i.ingredient.unit}
                    </td>
                    <td>{money(i.unit_price)}</td>
                    <td>{money(i.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detail.note && <p className="muted">{detail.note}</p>}
          <div className="row-between">
            <span>Tổng tiền</span>
            <strong>{money(detail.total)}</strong>
          </div>
        </Modal>
      )}
    </>
  );
}
