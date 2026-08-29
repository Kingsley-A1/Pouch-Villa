import { Breadcrumbs } from "@/components/breadcrumbs";
import { FindMyPhone } from "@/components/find-my-phone";
import { getBrands, getDevices } from "@pv/backend/db";

export const dynamic = "force-dynamic";
export default function FindMyCasePage() {
  return (
    <>
      <Breadcrumbs trail={[{ label: "Find my case" }]} />
      <section className="section-space">
        <div className="container-shell grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="eyebrow">Compatibility first</p>
            <h1 className="section-title mt-3">Find cases for your exact phone.</h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-zinc-600">
              Choose the brand, then the precise model. We remember it only on this device when you
              ask us to.
            </p>
          </div>
          <div className="rounded-[1.7rem] border border-[#e8e3df] bg-[#fcfaf8] p-6 sm:p-9">
            <FindMyPhone brands={getBrands()} devices={getDevices()} compact />
          </div>
        </div>
      </section>
    </>
  );
}
