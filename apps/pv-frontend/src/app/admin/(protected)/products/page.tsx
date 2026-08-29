import Image from "next/image";
import Link from "next/link";
import { Copy, Eye, Plus } from "@phosphor-icons/react/dist/ssr";
import { AdminHeader } from "@/components/admin-header";
import { duplicateProduct, setProductStatus } from "@/app/admin/(protected)/actions";
import { getProducts } from "@pv/backend/db";
import { availabilityTone, cn } from "@/lib/utils";
import { availabilityLabel, formatNaira } from "@pv/backend/domain/format";
export const dynamic = "force-dynamic";
export default function AdminProductsPage() {
  const products = getProducts({ includeAdmin: true });
  return (
    <>
      <AdminHeader
        eyebrow="Catalogue management"
        title="Products"
        description="Create, edit, duplicate, publish, unpublish and archive structured product records."
        action={
          <Link href="/admin/products/new" className="button-primary">
            <Plus size={18} /> New product
          </Link>
        }
      />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Demo price</th>
              <th>Availability</th>
              <th>Public status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <Image
                      src={product.image}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-xl object-cover"
                    />
                    <div>
                      <Link
                        className="font-bold hover:text-[#e30613]"
                        href={`/admin/products/${product.id}/edit`}
                      >
                        {product.name}
                      </Link>
                      <p className="mt-1 text-xs text-zinc-500">{product.slug}</p>
                    </div>
                  </div>
                </td>
                <td>Demo {formatNaira(product.demo_price)}</td>
                <td>
                  <span className={cn("status-pill", availabilityTone(product.availability))}>
                    {availabilityLabel(product.availability)}
                  </span>
                </td>
                <td>
                  <span className="status-pill bg-zinc-100 text-zinc-700">{product.status}</span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="button-ghost min-h-9 px-2 py-1 text-xs"
                      href={`/admin/products/${product.id}/edit`}
                    >
                      Edit
                    </Link>
                    <a
                      className="button-ghost min-h-9 px-2 py-1 text-xs"
                      href={`/products/${product.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Eye size={15} />
                    </a>
                    <form action={duplicateProduct}>
                      <input type="hidden" name="id" value={product.id} />
                      <button
                        className="button-ghost min-h-9 px-2 py-1 text-xs"
                        aria-label={`Duplicate ${product.name}`}
                      >
                        <Copy size={15} />
                      </button>
                    </form>
                    <form action={setProductStatus}>
                      <input type="hidden" name="id" value={product.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={product.status === "published" ? "unpublished" : "published"}
                      />
                      <button className="button-ghost min-h-9 px-2 py-1 text-xs">
                        {product.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                    </form>
                    <form action={setProductStatus}>
                      <input type="hidden" name="id" value={product.id} />
                      <input type="hidden" name="status" value="archived" />
                      <button className="button-ghost min-h-9 px-2 py-1 text-xs">Archive</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
