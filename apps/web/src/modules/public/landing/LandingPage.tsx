import { useEffect, useMemo, useState } from 'react'
import {
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from 'framer-motion'

type ModuleItem = {
  title: string
  description: string
  icon: React.ReactNode
}

type StepItem = {
  step: string
  title: string
  description: string
}

type ValueItem = {
  title: string
  icon: React.ReactNode
}

type FaqItem = {
  question: string
  answer: string
}

const modules: ModuleItem[] = [
  {
    title: 'Lead Scoring',
    description: 'Consolidate lead sources, clean records, and rank accounts with explainable scoring.',
    icon: <SparkIcon />,
  },
  {
    title: 'Intent Prediction',
    description: 'Surface short, medium, and long-term buying signals from engagement patterns.',
    icon: <SignalIcon />,
  },
  {
    title: 'Conversation Intelligence',
    description: 'Extract decision-makers, tone shifts, timelines, and follow-up cues from threads.',
    icon: <ChatIcon />,
  },
  {
    title: 'Alignment Dashboard',
    description: 'Give sales and marketing one shared view of pipeline, KPIs, and bottlenecks.',
    icon: <GridIcon />,
  },
  {
    title: 'ROI Attribution',
    description: 'Connect campaign spend to revenue contribution with clearer multi-touch visibility.',
    icon: <ChartIcon />,
  },
  {
    title: 'Funnel Leakage',
    description: 'Detect drop-off risk, fatigue, and weak handoffs before they impact revenue.',
    icon: <ShieldIcon />,
  },
]

const steps: StepItem[] = [
  {
    step: '01',
    title: 'Connect',
    description: 'Bring lead, campaign, and conversation inputs into one revenue layer.',
  },
  {
    step: '02',
    title: 'Analyze',
    description: 'Apply scoring, intent, attribution, and funnel intelligence across workflows.',
  },
  {
    step: '03',
    title: 'Align',
    description: 'Give sales, marketing, and leadership a shared operating view.',
  },
  {
    step: '04',
    title: 'Act',
    description: 'Move faster with clearer priorities, earlier warnings, and cleaner reporting.',
  },
]

const valueItems: ValueItem[] = [
  { title: 'Unify signals', icon: <SparkIcon /> },
  { title: 'Prioritize leads', icon: <SignalIcon /> },
  { title: 'Detect leakage', icon: <ShieldIcon /> },
  { title: 'Measure ROI', icon: <ChartIcon /> },
]

const faqItems: FaqItem[] = [
  {
    question: 'Who is 2-Synced designed for?',
    answer:
      'It is designed for B2B SMEs that want better coordination between sales, marketing, and leadership without stitching together endless spreadsheets.',
  },
  {
    question: 'Do I need all modules at once?',
    answer:
      'No. The platform is modular, so teams can start with one workflow and expand into a more connected operating model over time.',
  },
  {
    question: 'Does the landing page replace the app?',
    answer:
      'No. This is the public-facing entry point. Login still takes users into the actual authenticated product experience.',
  },
]

function goToLogin() {
  window.location.hash = '#/login'
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{
        duration: 0.62,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function FloatingMetricCard({
  className,
  title,
  value,
  accent,
  delay = 0,
}: {
  className?: string
  title: string
  value: string
  accent: string
  delay?: number
}) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 20 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
      animate={
        reducedMotion
          ? undefined
          : {
              y: [0, -6, 0],
            }
      }
      transition={
        reducedMotion
          ? undefined
          : {
              opacity: { duration: 0.5, delay },
              y: {
                delay,
                duration: 5.6,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: 'mirror',
                ease: 'easeInOut',
              },
            }
      }
      className={[
        'border border-white/45 bg-white/78 shadow-[0_20px_40px_rgba(15,23,42,0.10)] backdrop-blur-xl',
        className ?? '',
      ].join(' ')}
    >
      <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/6">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
        </span>
        {title}
      </div>
      <div className="text-lg font-semibold tracking-[-0.04em] text-slate-900">{value}</div>
      <div className="mt-3 h-1.5 rounded-full bg-slate-900/8">
        <div className="h-full rounded-full" style={{ width: '68%', backgroundColor: accent }} />
      </div>
    </motion.div>
  )
}

export default function LandingPage() {
  const reducedMotion = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)
  const { scrollY } = useScroll()
  const heroVisualY = useTransform(scrollY, [0, 500], [0, reducedMotion ? 0 : -26])
  const heroGlowY = useTransform(scrollY, [0, 500], [0, reducedMotion ? 0 : -18])

  useEffect(() => {
    document.documentElement.classList.add('landing-page-open')
    document.body.classList.add('landing-page-open')

    const onScroll = () => setScrolled(window.scrollY > 18)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
      document.documentElement.classList.remove('landing-page-open')
      document.body.classList.remove('landing-page-open')
    }
  }, [])

  const moduleVariants = useMemo<Variants>(
    () => ({
      hidden: { opacity: 0, y: 24 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.58, ease: [0.22, 1, 0.36, 1] },
      },
    }),
    [],
  )

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-shell min-h-screen bg-[#f5f7f8] text-slate-900">
        <header className="fixed inset-x-0 top-0 z-50 px-4 py-4 sm:px-6 lg:px-8">
          <motion.div
            initial={false}
            animate={{
              backgroundColor: scrolled ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.08)',
              boxShadow: scrolled ? '0 18px 40px rgba(15,23,42,0.10)' : '0 10px 28px rgba(15,23,42,0.04)',
              borderColor: scrolled ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.14)',
            }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="mx-auto flex max-w-6xl items-center justify-between rounded-full border px-4 py-3 backdrop-blur-2xl sm:px-6"
          >
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })}
              className="flex items-center gap-3 bg-transparent p-0 text-left shadow-none"
              aria-label="Scroll to top"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/18 bg-white/8 text-white/88 backdrop-blur-md">
                <BrandGlyph className="h-[18px] w-[18px]" />
              </span>
              <span className="flex flex-col">
                <span
                  className="text-lg font-extrabold tracking-[-0.045em] text-slate-950"
                  style={{ fontFamily: 'Manrope, Inter, system-ui, sans-serif' }}
                >
                  2-Synced
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Revenue Intelligence
                </span>
              </span>
            </button>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={goToLogin}
                className="rounded-full border border-white/80 bg-white px-4 py-2 text-sm font-semibold text-[#0f6a69] transition-all duration-200 hover:-translate-y-0.5 hover:border-white hover:text-[#0b5b5a]"
              >
                Login
              </button>
            </div>
          </motion.div>
        </header>

        <main>
          <section
            id="product"
            className="relative overflow-hidden bg-[linear-gradient(120deg,#062033_0%,#0d3f54_48%,#0f6a69_100%)] px-4 pb-20 pt-32 text-white sm:px-6 md:pb-24 lg:px-8 lg:pt-36"
          >
            <motion.div
              style={{ y: heroGlowY }}
              className="absolute inset-x-0 top-12 h-72 bg-[radial-gradient(circle,rgba(109,214,220,0.17)_0%,rgba(109,214,220,0)_68%)]"
            />
            <div className="pointer-events-none absolute inset-0 opacity-[0.10] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:34px_34px]" />

            <div className="relative mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.94fr_1.06fr] lg:items-center">
              <Reveal className="max-w-xl lg:max-w-2xl">
                <div className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.30em] text-white/70">
                  Precision for modern revenue teams
                </div>

                <h1 className="mt-6 max-w-[11ch] text-5xl font-extrabold leading-[0.95] tracking-[-0.065em] text-white sm:text-6xl lg:text-[4.9rem]">
                  Unify sales and marketing intelligence.
                </h1>

                <p className="mt-6 max-w-lg text-[15px] leading-7 text-slate-200 sm:text-lg">
                  Bring lead quality, intent, campaign performance, conversation insight, and attribution into one coordinated operating surface.
                </p>

                <div className="mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
                  {[
                    ['Connected signals', 'CRM, campaigns, conversations'],
                    ['Shared priorities', 'One view across GTM teams'],
                    ['Measured impact', 'Pipeline to ROI continuity'],
                  ].map(([title, detail], index) => (
                    <motion.div
                      key={title}
                      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
                      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.25 }}
                      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                      className="rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-md"
                    >
                      <div className="text-sm font-semibold text-white">{title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-200/88">{detail}</div>
                    </motion.div>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <motion.div style={{ y: heroVisualY }} className="relative mx-auto w-full max-w-[560px] lg:max-w-[600px]">
                  <div className="absolute inset-0 rounded-[36px] bg-[radial-gradient(circle_at_20%_18%,rgba(109,214,220,0.18),transparent_40%),radial-gradient(circle_at_78%_24%,rgba(0,209,255,0.10),transparent_30%)] blur-2xl" />

                  <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,18,31,0.97)_0%,rgba(14,35,51,0.97)_55%,rgba(10,41,54,0.98)_100%)] px-5 pb-5 pt-5 shadow-[0_30px_80px_rgba(2,12,24,0.34)]">
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/40">
                          Unified Revenue Pulse
                        </div>
                        <div className="mt-1 text-[2rem] font-bold tracking-[-0.05em] text-white">
                          Live GTM Operating Layer
                        </div>
                      </div>
                      <div className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
                        Sync Active
                      </div>
                    </div>

                    <div className="grid h-[340px] grid-cols-12 grid-rows-8 gap-3 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(4,13,25,0.65),rgba(8,22,33,0.72))] p-4">
                      <DashboardBlock className="col-span-4 row-span-2" title="Lead Quality" variant="bars" />
                      <DashboardBlock className="col-span-4 row-span-2" title="Intent Mix" variant="line" />
                      <DashboardBlock className="col-span-4 row-span-2" title="ROI Signals" variant="table" />
                      <DashboardBlock className="col-span-5 row-span-3" title="Pipeline Velocity" variant="columns" />
                      <DashboardBlock className="col-span-4 row-span-3" title="Conversation Health" variant="wave" />
                      <DashboardBlock className="col-span-3 row-span-3" title="Leakage Risk" variant="gauge" />
                      <DashboardBlock className="col-span-4 row-span-3" title="Attribution" variant="network" />
                      <DashboardBlock className="col-span-4 row-span-3" title="Executive View" variant="columns" />
                      <DashboardBlock className="col-span-4 row-span-3" title="Shared KPIs" variant="bars" />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-3.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">Lead Velocity</div>
                        <div className="mt-2 text-3xl font-bold tracking-[-0.05em] text-white">+18%</div>
                      </div>
                      <div className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-3.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">Pipeline Alerts</div>
                        <div className="mt-2 text-3xl font-bold tracking-[-0.05em] text-white">04</div>
                      </div>
                      <div className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-3.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">Attribution Coverage</div>
                        <div className="mt-2 text-3xl font-bold tracking-[-0.05em] text-white">94%</div>
                      </div>
                    </div>
                  </div>

                  <FloatingMetricCard
                    className="absolute -left-3 top-8 w-[190px] rounded-[24px] px-4 py-3.5 text-slate-900 sm:-left-8"
                    title="Lead Scoring"
                    value="98.4 / 100"
                    accent="#0f6a69"
                    delay={0.25}
                  />
                  <FloatingMetricCard
                    className="absolute -right-2 top-28 w-[200px] rounded-[24px] px-4 py-3.5 text-slate-900 sm:-right-6"
                    title="Intent Signals"
                    value="3 accounts spiking"
                    accent="#29b9c1"
                    delay={0.55}
                  />
                  <FloatingMetricCard
                    className="absolute bottom-0 left-10 w-[210px] rounded-[24px] px-4 py-3.5 text-slate-900 sm:left-16"
                    title="ROI Attribution"
                    value="Multi-touch ready"
                    accent="#f1965d"
                    delay={0.85}
                  />
                </motion.div>
              </Reveal>
            </div>
          </section>

          <section className="bg-[#f4f6f8] px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-6xl gap-3 rounded-[30px] bg-white/78 p-3.5 shadow-[0_18px_34px_rgba(15,23,42,0.04)] sm:grid-cols-2 lg:grid-cols-4">
              {valueItems.map((item, index) => (
                <Reveal key={item.title} delay={index * 0.05}>
                  <div className="flex items-center gap-3 rounded-[24px] px-3 py-3 text-sm text-slate-700">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/5 text-[#0f6a69]">
                      {item.icon}
                    </span>
                    <span className="font-medium">{item.title}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section id="modules" className="bg-[#f8fafb] px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <Reveal className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f6a69]">
                  Intelligence Modules
                </div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                  Modular intelligence, shaped for revenue operations.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                  Start with the workflow you need most, then extend into a connected operating model.
                </p>
              </Reveal>

              <motion.div
                initial={reducedMotion ? false : 'hidden'}
                whileInView={reducedMotion ? undefined : 'visible'}
                viewport={{ once: true, amount: 0.14 }}
                transition={{ staggerChildren: 0.08 }}
                className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3"
              >
                {modules.map((module) => (
                  <motion.article
                    key={module.title}
                    variants={moduleVariants}
                    whileHover={reducedMotion ? undefined : { y: -6 }}
                    className="rounded-[28px] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_14px_34px_rgba(15,23,42,0.04)] transition-shadow duration-300 hover:shadow-[0_22px_44px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex h-full flex-col">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,rgba(15,106,105,0.14),rgba(109,214,220,0.18))] text-[#0f6a69]">
                        {module.icon}
                      </span>
                      <h3 className="mt-5 text-xl font-bold tracking-[-0.04em] text-slate-950">{module.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{module.description}</p>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            </div>
          </section>

          <section id="how-it-works" className="bg-[#f8fafb] px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <Reveal className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f6a69]">
                  How it works
                </div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                  Engineered for alignment.
                </h2>
              </Reveal>

              <motion.div
                initial={reducedMotion ? false : 'hidden'}
                whileInView={reducedMotion ? undefined : 'visible'}
                viewport={{ once: true, amount: 0.24 }}
                transition={{ staggerChildren: 0.12 }}
                className="relative mt-16 grid gap-10 lg:grid-cols-4"
              >
                <div className="absolute left-0 right-0 top-7 hidden h-px bg-[linear-gradient(90deg,rgba(15,106,105,0.08),rgba(15,106,105,0.22),rgba(15,106,105,0.08))] lg:block" />
                {steps.map((item) => (
                  <motion.article key={item.title} variants={moduleVariants} className="relative text-center lg:text-left">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0b2f43_0%,#0f6a69_100%)] text-base font-semibold text-white shadow-[0_20px_36px_rgba(15,106,105,0.18)] lg:mx-0">
                      {item.step}
                    </div>
                    <h3 className="mt-6 text-xl font-bold tracking-[-0.04em] text-slate-950">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                  </motion.article>
                ))}
              </motion.div>
            </div>
          </section>

          <section className="bg-[#f3f6f8] px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <Reveal className="max-w-xl">
                <div className="inline-flex rounded-full bg-[rgba(15,106,105,0.08)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f6a69]">
                  Product spotlight
                </div>
                <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                  Reduce GTM noise. Increase decision clarity.
                </h2>
                <p className="mt-4 text-base leading-7 text-slate-600">
                  2-Synced is built to connect lead intelligence, campaign performance, conversations, and revenue visibility into one cleaner operating view.
                </p>
                <div className="mt-8 grid gap-4">
                  {[
                    'Shared pipeline and KPI visibility for sales and marketing',
                    'Decision-support intelligence across scoring, intent, and attribution',
                    'Cleaner operating context for leadership and execution teams',
                  ].map((item) => (
                    <div key={item} className="rounded-[24px] border border-slate-200/80 bg-white px-5 py-4 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={0.08}>
                <div className="rounded-[34px] border border-slate-200/80 bg-white p-6 shadow-[0_24px_50px_rgba(15,23,42,0.06)] sm:p-8">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FeaturePanel
                      title="Signal overview"
                      subtitle="Cross-functional summary"
                      body="View lead quality, engagement shifts, and conversion context without jumping across disconnected reports."
                    />
                    <FeaturePanel
                      title="Executive clarity"
                      subtitle="Leadership-ready reporting"
                      body="Bring operational metrics into a more readable layer for management reviews and strategic decision-making."
                    />
                    <FeaturePanel
                      title="Attribution surface"
                      subtitle="Campaign to revenue continuity"
                      body="Understand which efforts influence performance with a cleaner multi-touch perspective."
                    />
                    <FeaturePanel
                      title="Workflow readiness"
                      subtitle="Modular rollout"
                      body="Start with one area of the system and expand into a connected revenue intelligence workflow."
                    />
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          <section id="pricing" className="bg-[#f6f8f9] px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <Reveal className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f6a69]">
                  Platform access
                </div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                  Scaled for revenue teams that need signal clarity.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
                  Workspace-based access, modular rollout, and one connected GTM operating model.
                </p>
              </Reveal>

              <Reveal delay={0.08} className="mt-12">
                <div className="rounded-[36px] border border-slate-200/80 bg-white p-8 shadow-[0_18px_40px_rgba(15,23,42,0.05)] lg:p-10">
                  <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
                    <div>
                      <div className="inline-flex rounded-full bg-[rgba(15,106,105,0.08)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f6a69]">
                        Workspace access
                      </div>
                      <h3 className="mt-5 text-3xl font-extrabold tracking-[-0.05em] text-slate-950">
                        Built for teams that need one cleaner operating layer.
                      </h3>
                      <p className="mt-4 text-base leading-7 text-slate-600">
                        Use workspace-level access, structured module rollout, and shared reporting surfaces across the revenue journey.
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {[
                        'Workspace management and role-based access',
                        'Module-driven rollout across the revenue journey',
                        'Connected reporting surfaces for sales and marketing',
                        'Built to support cleaner attribution and pipeline visibility',
                      ].map((item) => (
                        <div key={item} className="rounded-[28px] bg-[#f5f7f8] px-5 py-5 text-sm leading-6 text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </section>

          <section className="bg-[#f4f7f9] px-4 py-20 sm:px-6 lg:px-8">
            <Reveal>
              <motion.div
                whileInView={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.98 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="mx-auto max-w-6xl rounded-[40px] bg-[linear-gradient(135deg,#0b2237_0%,#0f4258_52%,#0f6a69_100%)] px-8 py-14 text-center text-white shadow-[0_30px_70px_rgba(10,69,75,0.18)] sm:px-12"
              >
                <div className="mx-auto max-w-2xl">
                  <h2 className="text-3xl font-extrabold tracking-[-0.05em] sm:text-4xl">
                    Ready to align your revenue engine?
                  </h2>
                  <p className="mt-4 text-base leading-7 text-teal-50/88">
                    Step into a shared intelligence layer for sales, marketing, and leadership.
                  </p>
                  <motion.button
                    type="button"
                    onClick={goToLogin}
                    whileHover={reducedMotion ? undefined : { y: -2 }}
                    whileTap={reducedMotion ? undefined : { scale: 0.99 }}
                    className="mt-8 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-slate-950"
                  >
                    Login
                  </motion.button>
                </div>
              </motion.div>
            </Reveal>
          </section>

          <section id="faq" className="bg-[#f8fafb] px-4 pb-20 pt-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <Reveal className="text-center">
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#0f6a69]">
                  FAQ
                </div>
                <h2 className="mt-4 text-3xl font-extrabold tracking-[-0.05em] text-slate-950 sm:text-4xl">
                  A few quick answers.
                </h2>
              </Reveal>

              <div className="mt-12 grid gap-4">
                {faqItems.map((item, index) => (
                  <Reveal key={item.question} delay={index * 0.05}>
                    <div className="rounded-[24px] border border-slate-200/80 bg-white px-6 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.03)]">
                      <h3 className="text-base font-semibold text-slate-950">{item.question}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-slate-200/80 bg-white px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0b2f43_0%,#0f6a69_65%,#6dd6dc_100%)] text-white">
                <BrandGlyph />
              </span>
              <span className="font-medium text-slate-700">2-Synced</span>
            </div>
            <div>AI-powered revenue intelligence for modern B2B teams.</div>
          </div>
        </footer>
      </div>
    </MotionConfig>
  )
}

function DashboardBlock({
  className,
  title,
  variant,
}: {
  className?: string
  title: string
  variant: 'bars' | 'columns' | 'line' | 'wave' | 'gauge' | 'network' | 'table'
}) {
  return (
    <div
      className={[
        'rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(16,34,48,0.78),rgba(12,25,36,0.88))] p-3',
        className ?? '',
      ].join(' ')}
    >
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.20em] text-white/38">{title}</div>

      {variant === 'bars' && (
        <div className="flex h-[calc(100%-22px)] items-end gap-2">
          {[34, 50, 42, 68, 58, 76].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-lg bg-[linear-gradient(180deg,#44d3d6,#0f6a69)]" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}

      {variant === 'columns' && (
        <div className="grid h-[calc(100%-22px)] grid-cols-6 items-end gap-2">
          {[58, 32, 74, 49, 62, 84].map((h, i) => (
            <div key={i} className="rounded-t-lg bg-[linear-gradient(180deg,#6dd6dc,#14b8c4)]" style={{ height: `${h}%` }} />
          ))}
        </div>
      )}

      {variant === 'line' && (
        <div className="relative h-[calc(100%-22px)] overflow-hidden rounded-[14px] bg-white/[0.02]">
          <svg viewBox="0 0 200 100" className="h-full w-full">
            <path
              d="M8 72 C36 68, 48 52, 72 50 S112 20, 136 28 S170 56, 192 22"
              fill="none"
              stroke="#4cd4d6"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {variant === 'wave' && (
        <div className="relative h-[calc(100%-22px)] overflow-hidden rounded-[14px] bg-white/[0.02]">
          <svg viewBox="0 0 200 100" className="h-full w-full">
            <path
              d="M0 72 C18 56, 34 60, 50 68 S84 84, 100 60 S132 24, 150 38 S180 72, 200 44"
              fill="none"
              stroke="#57d0c8"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      {variant === 'gauge' && (
        <div className="flex h-[calc(100%-22px)] items-center justify-center">
          <div className="relative h-20 w-20 rounded-full border-[10px] border-white/8 border-t-[#6dd6dc] border-r-[#0f6a69]">
            <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-white">72</div>
          </div>
        </div>
      )}

      {variant === 'network' && (
        <div className="relative h-[calc(100%-22px)]">
          <div className="absolute left-[18%] top-[22%] h-3 w-3 rounded-full bg-[#6dd6dc]" />
          <div className="absolute left-[54%] top-[28%] h-3 w-3 rounded-full bg-[#57d0c8]" />
          <div className="absolute left-[72%] top-[58%] h-3 w-3 rounded-full bg-[#14b8c4]" />
          <div className="absolute left-[28%] top-[68%] h-3 w-3 rounded-full bg-[#0f6a69]" />
          <div className="absolute left-[20%] top-[24%] h-px w-[36%] rotate-[12deg] bg-white/30" />
          <div className="absolute left-[40%] top-[46%] h-px w-[28%] rotate-[26deg] bg-white/30" />
          <div className="absolute left-[30%] top-[62%] h-px w-[42%] -rotate-[12deg] bg-white/30" />
        </div>
      )}

      {variant === 'table' && (
        <div className="grid gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[1.2fr_0.8fr] gap-2">
              <div className="h-3 rounded-full bg-white/10" />
              <div className="h-3 rounded-full bg-white/6" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FeaturePanel({
  title,
  subtitle,
  body,
}: {
  title: string
  subtitle: string
  body: string
}) {
  return (
    <div className="rounded-[26px] bg-[#f5f7f8] px-5 py-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#0f6a69]">{subtitle}</div>
      <h3 className="mt-3 text-lg font-bold tracking-[-0.03em] text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  )
}

function BrandGlyph({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 7h5a4 4 0 1 1 0 8H8a3 3 0 1 0 0 6h6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 5h3a3 3 0 0 1 0 6h-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 18h16" strokeLinecap="round" />
      <path d="M7 14V9" strokeLinecap="round" />
      <path d="M12 14V6" strokeLinecap="round" />
      <path d="M17 14v-3" strokeLinecap="round" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 18 3 21V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19h16" strokeLinecap="round" />
      <path d="m6 15 4-4 3 2 5-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 7h0" strokeLinecap="round" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 5 6v6c0 4.6 2.9 7.8 7 9 4.1-1.2 7-4.4 7-9V6l-7-3Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9.5 12 1.7 1.7 3.8-3.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
