import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, DeviceMobile, MapPin, ShieldCheck, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { FindMyPhone } from "@/components/find-my-phone";
import { ProductGrid } from "@/components/product-grid";
import { RememberedPhoneBanner } from "@/components/remembered-phone";
import { WhatsAppEnquiry } from "@/components/whatsapp-enquiry";
import { getBrands, getCollections, getDevices, getProducts, getSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

const styleLinks = [
  ["Minimalist", "Quiet form, clean finish", "/collections/minimalist"],
  ["Soft Colours", "Calm tones for everyday style", "/collections/soft-colours"],
  ["Bold Styles", "Designed to stand out", "/collections/bold-styles"],
] as const;

export default function HomePage() {
  const brands = getBrands();
  const devices = getDevices();
  const collections = getCollections();
  const newArrivals = getProducts({ newOnly: "true" }).slice(0, 8);
  const bestsellers = getProducts({ bestseller: "true" }).slice(0, 4);
  const address = process.env.NEXT_PUBLIC_STORE_ADDRESS || getSetting("store_address");
  const hours = process.env.NEXT_PUBLIC_STORE_HOURS || getSetting("opening_hours");
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || getSetting("whatsapp_number");
  return <>
    <RememberedPhoneBanner />
    <section className="relative overflow-hidden bg-[#fcfaf8]">
      <div className="container-shell grid items-center gap-7 py-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:py-20">
        {/* Image sits first on small screens so it is visible without scrolling. */}
        <div className="relative order-1 min-h-[230px] overflow-hidden rounded-[2rem] bg-[#f6f3f1] sm:min-h-[320px] lg:order-2 lg:min-h-[620px]">
          <Image src="/images/pouch-villa-hero.png" alt="Phone cases in Pouch Hub colours" fill priority sizes="(max-width: 1024px) 100vw, 48vw" className="object-cover object-[67%_center]" />
        </div>
        <div className="relative z-10 order-2 lg:order-1">
          <h1 className="display-title max-w-2xl">Protect Your Phone.<br /><span className="text-[#e30613]">Show Your Style.</span></h1>
          <p className="mt-4 max-w-md text-lg leading-8 text-zinc-600">Cases matched to your exact phone model.</p>
          <div className="mt-7 rounded-[1.6rem] border border-[#e8e3df] bg-white p-5 shadow-[0_24px_70px_rgba(38,24,22,.08)] sm:p-6"><FindMyPhone brands={brands} devices={devices} /></div>
        </div>
      </div>
    </section>

    <section className="border-y border-[#e8e3df] bg-white"><div className="container-shell grid gap-5 py-6 sm:grid-cols-3"><div className="flex gap-3"><DeviceMobile className="text-[#e30613]" size={24} /><div><p className="font-bold">Exact-model discovery</p><p className="text-sm text-zinc-500">Confirm compatibility before action.</p></div></div><div className="flex gap-3"><ShieldCheck className="text-[#e30613]" size={24} /><div><p className="font-bold">Protection made clear</p><p className="text-sm text-zinc-500">Materials and protection explained.</p></div></div><div className="flex gap-3"><MapPin className="text-[#e30613]" size={24} /><div><p className="font-bold">Reserve for pickup</p><p className="text-sm text-zinc-500">Prepare first; staff confirms next.</p></div></div></div></section>

    <section className="section-space"><div className="container-shell"><div className="mb-8 flex items-end justify-between gap-4"><div><p className="eyebrow">Fresh demonstration catalogue</p><h2 className="section-title mt-3">New arrivals</h2></div><Link href="/collections/new-arrivals" className="button-ghost hidden sm:inline-flex">View all <ArrowRight size={18} /></Link></div><ProductGrid products={newArrivals} /></div></section>

    <section className="section-space bg-[#f6f3f1]"><div className="container-shell"><p className="eyebrow">Start with your device</p><h2 className="section-title mt-3">Shop by phone</h2><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{brands.map((brand) => <Link key={brand.id} href={`/find-my-case?brand=${brand.slug}`} className="group flex items-center justify-between rounded-2xl bg-white p-5 font-bold transition hover:-translate-y-0.5 hover:shadow-md"><span>{brand.name}</span><ArrowRight className="text-[#e30613] transition group-hover:translate-x-1" size={19} /></Link>)}</div></div></section>

    <section className="section-space"><div className="container-shell grid gap-12 lg:grid-cols-2"><div><p className="eyebrow">Style first, fit still confirmed</p><h2 className="section-title mt-3">Shop by style</h2><div className="mt-8 divide-y divide-[#e8e3df] border-y border-[#e8e3df]">{styleLinks.map(([title, copy, href]) => <Link href={href} key={href} className="group flex items-center justify-between py-6"><span><strong className="block text-xl">{title}</strong><span className="mt-1 block text-sm text-zinc-500">{copy}</span></span><ArrowRight className="text-[#e30613] transition group-hover:translate-x-1" /></Link>)}</div></div><div><p className="eyebrow">Built for how you use it</p><h2 className="section-title mt-3">Shop by protection</h2><div className="mt-8 grid gap-4 sm:grid-cols-3">{[["Everyday","/shop?protection=Everyday"],["Enhanced","/shop?protection=Enhanced"],["Heavy duty","/shop?protection=Heavy+duty"]].map(([label, href]) => <Link href={href} key={label} className="card-surface grid min-h-44 content-between p-5 transition hover:border-[#e30613]"><ShieldCheck size={30} className="text-[#e30613]" /><strong>{label}</strong></Link>)}</div></div></div></section>

    <section className="section-space bg-gradient-to-b from-[#fdf6f4] via-[#faf7f5] to-white"><div className="container-shell"><div className="mb-9 flex items-end justify-between gap-4"><div><p className="eyebrow">Curated entry points</p><h2 className="section-title mt-3">Featured collections</h2></div><Link href="/collections" className="button-ghost hidden sm:inline-flex">All collections</Link></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{collections.slice(0, 6).map((collection) => <Link href={`/collections/${collection.slug}`} key={collection.id} className="group flex min-h-52 flex-col justify-between rounded-2xl border border-[#eee7e3] bg-white/70 p-6 transition duration-300 hover:-translate-y-1 hover:border-[#e30613]/35 hover:bg-white hover:shadow-[0_18px_44px_rgba(38,24,22,.09)]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#fdecec]"><Sparkle size={22} className="text-[#e30613]" /></span><div className="mt-10"><h3 className="text-xl font-bold">{collection.name}</h3><p className="mt-2 text-sm leading-6 text-zinc-500">{collection.description}</p></div></Link>)}</div></div></section>

    <section className="section-space"><div className="container-shell"><p className="eyebrow">Popular in the prototype</p><h2 className="section-title mt-3 mb-8">Bestsellers</h2><ProductGrid products={bestsellers} /></div></section>

    <section className="section-space bg-red-50"><div className="container-shell grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-center"><div><p className="eyebrow">Reservation, without checkout</p><h2 className="section-title mt-3">Choose. Confirm. Reserve. Pick up.</h2><p className="mt-5 max-w-xl leading-7 text-zinc-600">The prototype creates a confirmation reference for staff follow-up. It does not accept payment, promise live stock or send a real message.</p><Link href="/help#reservations" className="button-primary mt-7">How reservations work <ArrowRight size={18} /></Link></div><ol className="grid gap-3">{["Confirm your exact phone model", "Choose a demonstration product and variant", "Submit a pickup reservation", "Staff verifies availability and contacts you"].map((item, index) => <li key={item} className="flex items-center gap-4 rounded-2xl bg-white p-5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e30613] font-bold text-white">{index + 1}</span><span className="font-bold">{item}</span></li>)}</ol></div></section>

    <section className="section-space"><div className="container-shell grid overflow-hidden rounded-[2rem] border border-[#e8e3df] lg:grid-cols-2"><div className="relative min-h-[420px]"><Image src="/images/phone-cases-display.jpg" alt="A spread of phone cases in assorted colours and patterns" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" /></div><div className="p-7 sm:p-10 lg:p-14"><p className="eyebrow">Visit the physical store</p><h2 className="section-title mt-3">See the cases in person.</h2><div className="mt-8 grid gap-5"><div className="flex gap-3"><MapPin className="mt-1 shrink-0 text-[#e30613]" size={23} /><div><p className="font-bold">Store address</p><p className="mt-1 text-zinc-600">{address || "Exact address awaiting Pouch Hub confirmation."}</p></div></div><div className="flex gap-3"><Clock className="mt-1 shrink-0 text-[#e30613]" size={23} /><div><p className="font-bold">Opening hours</p><p className="mt-1 text-zinc-600">{hours || "Opening hours awaiting Pouch Hub confirmation."}</p></div></div></div><div className="mt-8 flex flex-wrap gap-3"><Link href="/visit-us" className="button-primary">Visit Us</Link><WhatsAppEnquiry number={whatsapp} message="Hello Pouch Hub, I would like to confirm your official store address and opening hours before visiting." label="Prepare store enquiry" /></div></div></div></section>

    <section className="section-space bg-[#f6f3f1]"><div className="container-shell grid gap-10 lg:grid-cols-[.75fr_1.25fr]"><div><p className="eyebrow">Quick answers</p><h2 className="section-title mt-3">Before you reserve</h2><Link href="/help" className="button-ghost mt-6">See all FAQs</Link></div><div className="divide-y divide-[#dcd5d0]">{[["How do I know a case fits?","Select and confirm your exact phone model before reserving or preparing an enquiry."],["Does the prototype show live stock?","No. Availability is demonstration data until Pouch Hub confirms an operating process."],["Can I pay online?","No. Online payment is intentionally outside this prototype."],["Will WhatsApp send automatically?","No real message is sent. Without an approved number, you receive a safe message preview."]].map(([question, answer]) => <details key={question} className="group py-5"><summary className="cursor-pointer list-none font-bold">{question}</summary><p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">{answer}</p></details>)}</div></div></section>
  </>;
}
