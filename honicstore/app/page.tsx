import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight, BadgeCheck, Bot, ChevronRight, MessageCircle, PackageCheck, ShieldCheck, Smartphone, Sparkles, Store, Truck, Wallet,
} from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { HomeSearch } from '@/components/home/home-search'
import { CategoryIcon } from '@/components/home/category-icon'
import { ProductTile, productHref } from '@/components/home/product-tile'
import { getHomeData } from '@/lib/home-data'
import { optimizedImg } from '@/lib/image-optimize'
import { whatsappLink } from '@/lib/contact'

/**
 * Home page: Honic is an online marketplace for Tanzania. Honic's own official store is the main seller
 * (today: electronics & DIY components), and other sellers can open shops in every department.
 * Server-rendered from real catalogue data, refreshed every 5 minutes.
 */
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Honic Store | Online shopping in Tanzania',
  description:
    'Shop electronics, home devices, school items and more from Honic and trusted sellers across Tanzania. Pay with mobile money and track every order.',
  alternates: { canonical: '/' },
}

const AI_EXAMPLES = [
  { ask: 'A gift for a student who loves robotics', picks: ['Robotics starter kit', 'Arduino Uno', 'Servo motor'] },
  { ask: 'Nataka kupima joto la chumba', picks: ['DHT11 sensor', 'ESP32 board', 'Jumper wires'] },
]

const deptHref = (slug: string) => `/products?mainCategory=${encodeURIComponent(slug)}`

export default async function HomePage() {
  const { popular, newest, deals, totalProducts, departments, official, officialCats } = await getHomeData()
  const heroPicks = popular.filter((p) => p.image).slice(0, 4)
  const openDepartments = departments.filter((d) => d.count > 0)
  const comingSoon = departments.filter((d) => d.count === 0)
  const liveDepartments = openDepartments.length
  // few departments open (early days): fewer, wider cards so the row is filled
  const wideCards = liveDepartments <= 2

  return (
    <div className="min-h-screen bg-[#f6f6f7] text-neutral-950">
      <SiteHeader />

      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden border-b border-neutral-200/70 bg-gradient-to-b from-orange-50/80 via-white to-[#f6f6f7]">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-orange-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 top-40 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:pb-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-orange-700 ring-1 ring-orange-200 backdrop-blur">
              <Store className="h-3.5 w-3.5" /> Tanzania&apos;s online marketplace · pay with mobile money
            </p>
            <h1 className="mt-4 text-[2.1rem] font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Everything you need,
              <br className="hidden sm:block" /> <span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">delivered</span> to your door.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 sm:text-lg">
              Shop the official Honic store and trusted sellers across Tanzania: electronics, home devices, school items and more.
              Pay with mobile money and follow every order to your door.
            </p>
            <div className="mt-7 max-w-2xl">
              <HomeSearch />
            </div>
          </div>

          {/* product collage */}
          {heroPicks.length >= 4 && (
            <div className="relative mx-auto hidden w-full max-w-md lg:block">
              <div className="grid grid-cols-2 gap-4">
                {heroPicks.map((p, i) => (
                  <Link
                    key={p.id}
                    href={productHref(p)}
                    className={`group rounded-3xl bg-white p-4 shadow-xl shadow-neutral-900/5 ring-1 ring-neutral-200/70 transition hover:-translate-y-1 ${i % 2 ? 'translate-y-8' : ''}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={optimizedImg(p.image, 200)} alt={p.name} loading="eager" className="aspect-square w-full object-contain transition-transform duration-300 group-hover:scale-105" />
                    <p className="mt-2 line-clamp-1 text-xs font-semibold text-neutral-700">{p.name}</p>
                  </Link>
                ))}
              </div>
              <div className="absolute -bottom-2 -left-8 flex items-center gap-3 rounded-2xl bg-neutral-950 px-4 py-3 text-white shadow-2xl">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600"><BadgeCheck className="h-4 w-4" /></span>
                <div>
                  <p className="text-xs text-neutral-400">Official Honic store</p>
                  <p className="text-sm font-bold">{totalProducts > 0 ? `${totalProducts}+ products in stock` : 'Genuine products'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-14 px-4 py-10 sm:px-6">
        {/* ---------- departments ---------- */}
        {departments.length > 0 && (
          <section aria-labelledby="departments">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 id="departments" className="text-xl font-black tracking-tight sm:text-2xl">Shop by department</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {liveDepartments > 1 ? `${liveDepartments} departments open now, more coming as sellers join.` : 'New departments open as sellers join.'}
                </p>
              </div>
              <Link href="/categories" className="-my-2 flex shrink-0 items-center gap-1 py-2 text-sm font-bold text-orange-600 hover:text-orange-700">
                All categories <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            {/* open departments: big picture cards */}
            <div className={`grid gap-3 ${wideCards ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
              {openDepartments.map((d) => (
                <Link key={d.id} href={deptHref(d.slug)} className="group relative overflow-hidden rounded-3xl bg-neutral-900 text-white ring-1 ring-neutral-200/70 transition hover:shadow-xl">
                  <div className={wideCards ? 'aspect-[16/9] sm:aspect-[2/1]' : 'aspect-[4/3]'}>
                    {d.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={optimizedImg(d.image, wideCards ? 640 : 320)} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />
                    ) : (
                      <span className="grid h-full place-items-center bg-gradient-to-br from-orange-500 to-amber-500"><CategoryIcon slug={d.slug} className="h-10 w-10" /></span>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-10">
                    <p className={`font-bold leading-tight ${wideCards ? 'text-xl sm:text-2xl' : ''}`}>{d.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-white/80">{d.count} {d.count === 1 ? 'product' : 'products'} <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></p>
                  </div>
                </Link>
              ))}
            </div>

            {/* departments still waiting for sellers: compact strip */}
            {comingSoon.length > 0 && (
              <div className="mt-3 flex flex-col gap-3 rounded-3xl border border-dashed border-neutral-300 bg-white p-4 sm:flex-row sm:items-center">
                <p className="shrink-0 text-xs font-bold uppercase tracking-wider text-neutral-400">Coming soon</p>
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  {comingSoon.map((d) => (
                    <span key={d.id} className="flex items-center gap-1.5 rounded-full bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-600 ring-1 ring-neutral-200">
                      <CategoryIcon slug={d.slug} className="h-3.5 w-3.5 text-neutral-400" /> {d.name}
                    </span>
                  ))}
                </div>
                <Link href="/become-supplier" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100">
                  Sell in these departments <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </section>
        )}

        {/* ---------- official Honic store ---------- */}
        {official && popular.length > 0 && (
          <section aria-labelledby="official" className="overflow-hidden rounded-[2rem] bg-white ring-1 ring-neutral-200/70">
            <div className="flex flex-col gap-4 border-b border-neutral-100 bg-gradient-to-r from-orange-50 via-white to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30">
                  <BadgeCheck className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">Official store</p>
                  <h2 id="official" className="text-xl font-black tracking-tight sm:text-2xl">Honic {official.name}</h2>
                  <p className="text-sm text-neutral-500">Sold and shipped by Honic · {official.count} products · genuine and checked before dispatch</p>
                </div>
              </div>
              <Link href={deptHref(official.slug)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800">
                Visit the store <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {officialCats.length > 0 && (
              <div className="flex gap-2 overflow-x-auto px-5 pt-5 [scrollbar-width:none] sm:px-7 [&::-webkit-scrollbar]:hidden">
                {officialCats.slice(0, 14).map((c) => (
                  <Link
                    key={c.id}
                    href={`/products?mainCategory=${encodeURIComponent(official.slug)}&subCategory=${encodeURIComponent(c.slug)}`}
                    className="flex shrink-0 items-center gap-2 rounded-full bg-neutral-50 px-3 py-1.5 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-orange-50 hover:text-orange-700 hover:ring-orange-200"
                  >
                    <CategoryIcon slug={c.slug} className="h-4 w-4 text-orange-500" /> {c.name}
                    <span className="text-xs font-medium text-neutral-400">{c.count}</span>
                  </Link>
                ))}
              </div>
            )}
            <div className="p-5 sm:p-7">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-bold">Best sellers</h3>
                <Link href="/products?sort=popular" className="-my-2 flex items-center gap-1 py-2 text-sm font-bold text-orange-600 hover:text-orange-700">
                  See all <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {popular.slice(0, 12).map((p, i) => <ProductTile key={p.id} p={p} priority={i < 6} />)}
              </div>
            </div>
          </section>
        )}

        {/* ---------- deals ---------- */}
        {deals.length > 0 && (
          <section aria-labelledby="deals">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 id="deals" className="text-xl font-black tracking-tight sm:text-2xl">Today&apos;s deals</h2>
                <p className="mt-1 text-sm text-neutral-500">Lower prices across the store.</p>
              </div>
              <Link href="/products?sort=popular" className="-my-2 flex shrink-0 items-center gap-1 py-2 text-sm font-bold text-orange-600 hover:text-orange-700">
                More deals <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {deals.map((p) => <ProductTile key={p.id} p={p} />)}
            </div>
          </section>
        )}

        {/* ---------- sell on Honic ---------- */}
        <section className="relative overflow-hidden rounded-[2rem] bg-neutral-950 px-6 py-10 text-white sm:px-10 lg:px-14">
          <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-orange-500/30 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-orange-300">
                <Store className="h-3.5 w-3.5" /> For businesses
              </p>
              <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl">Have products to sell? Open your shop on Honic.</h2>
              <p className="mt-3 max-w-lg text-neutral-400">
                List your products, reach buyers across Tanzania and get paid by mobile money. We run the checkout and payments, so you can focus on your stock.
              </p>
              <Link href="/become-supplier" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3.5 text-sm font-bold shadow-lg shadow-orange-900/40 hover:bg-orange-600">
                Start selling <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Store, title: 'Your brand on every listing', text: 'Your company name, logo and rating shown to buyers.' },
                { icon: Wallet, title: 'Mobile money payouts', text: 'Buyers pay online; track your payouts in the dashboard.' },
                { icon: Truck, title: 'Checkout handled', text: 'Payments, receipts and order updates run by Honic.' },
                { icon: BadgeCheck, title: 'Verified badge', text: 'Build trust with buyers once verified.' },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <Icon className="h-5 w-5 text-orange-400" />
                  <p className="mt-2 font-bold">{title}</p>
                  <p className="text-sm text-neutral-400">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- new arrivals ---------- */}
        {newest.length > 0 && (
          <section aria-labelledby="new">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 id="new" className="text-xl font-black tracking-tight sm:text-2xl">New arrivals</h2>
                <p className="mt-1 text-sm text-neutral-500">Just added to the store.</p>
              </div>
              <Link href="/products?sort=newest" className="-my-2 flex shrink-0 items-center gap-1 py-2 text-sm font-bold text-orange-600 hover:text-orange-700">
                See all <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {newest.slice(0, 12).map((p) => <ProductTile key={p.id} p={p} />)}
            </div>
          </section>
        )}

        {/* ---------- AI shopping helper ---------- */}
        <section className="grid items-center gap-8 rounded-[2rem] bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 ring-1 ring-orange-100 sm:p-10 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-orange-700 ring-1 ring-orange-200">
              <Bot className="h-3.5 w-3.5" /> AI shopping helper
            </p>
            <h2 className="mt-4 text-2xl font-black leading-tight tracking-tight sm:text-3xl">Not sure what to buy? Just describe it.</h2>
            <p className="mt-3 max-w-lg text-neutral-600">
              Write what you need in English or Kiswahili. The AI finds matching products in the store and suggests what goes together.
            </p>
            <Link href="/products?mode=ai" className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-neutral-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-neutral-800">
              <Sparkles className="h-4 w-4" /> Ask the AI helper <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {AI_EXAMPLES.map((ex) => (
              <Link key={ex.ask} href={`/products?mode=ai&q=${encodeURIComponent(ex.ask)}`} className="block rounded-3xl bg-white p-5 ring-1 ring-neutral-200/70 transition hover:shadow-md">
                <div className="flex justify-end">
                  <p className="rounded-2xl rounded-tr-sm bg-orange-500 px-4 py-2 text-sm font-medium text-white">{ex.ask}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ex.picks.map((item, i) => (
                    <span key={item} className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-orange-500 text-[9px] font-black text-white">{i + 1}</span>{item}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- why Honic ---------- */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, title: 'Delivery across Tanzania', text: 'Dar es Salaam in 1–2 days, other regions in 2–6 days by bus or courier, or free pickup at our shop.' },
            { icon: Smartphone, title: 'Pay with your phone', text: 'M-Pesa, Airtel Money, Mixx by Yas or HaloPesa. Your PIN never touches our site.' },
            { icon: ShieldCheck, title: 'Buyer protection', text: 'Your payment is confirmed before an order ships. Wrong or damaged item? We sort it out.' },
            { icon: PackageCheck, title: 'Business & school orders', text: 'Bulk orders for schools, offices and companies, with invoices and TIN on request.' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl border border-neutral-200/70 bg-white p-5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-orange-600"><Icon className="h-5 w-5" /></span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-500">{text}</p>
            </div>
          ))}
        </section>

        {/* ---------- help ---------- */}
        <a href={whatsappLink('Hello Honic, I need help with an order.')} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-white p-6 ring-1 ring-emerald-100 transition hover:shadow-lg">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white"><MessageCircle className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold">Questions before you buy?</h3>
            <p className="text-sm text-neutral-600">Chat with our team on WhatsApp: real people, quick answers.</p>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-emerald-600 transition group-hover:translate-x-1" />
        </a>
      </main>

      <SiteFooter />
    </div>
  )
}
