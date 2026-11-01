// S1-25 · Landing page: two doors ("I'm a candidate" / "I'm a company") and "How it works" in
// 3 steps, as in Farouk's S1-12 mockup, with the S1-13 components. Texts from messages/.
// Companies don't sign up: the club sends them their login, so their button goes to their space.
import Link from "next/link";
import { BuildingIcon, FileUpIcon, GraduationCapIcon, QrCodeIcon, UserRoundCheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/site/page-container";
import { getTranslations } from "next-intl/server";
const stepIcons = [FileUpIcon, UserRoundCheckIcon, QrCodeIcon];

export default async function Home() {
  const t = await getTranslations("landing");
  return (
    <PageContainer className="gap-12 py-12 sm:py-16">
      <section className="flex flex-col items-center gap-4 text-center">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">{t("eyebrow")}</p>
        <h1 className="max-w-2xl font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {t("title")}
        </h1>
        <p className="max-w-xl text-base text-muted-foreground text-pretty">{t("subtitle")}</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Door
          icon={<GraduationCapIcon className="size-6" />}
          title={t("candidate.title")}
          text={t("candidate.text")}
          href="/candidate"
          cta={t("candidate.cta")}
          primary
        />
        <Door
          icon={<BuildingIcon className="size-6" />}
          title={t("company.title")}
          text={t("company.text")}
          href="/company"
          cta={t("company.cta")}
        />
      </section>

      <section className="flex flex-col gap-6" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-center font-heading text-2xl font-semibold">
          {t("howTitle")}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {stepIcons.map((Icon, i) => {
            const step = { title: t(`steps.${i}.title` as "steps.0.title"), text: t(`steps.${i}.text` as "steps.0.text") };
            return (
              <li key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
                    {i + 1}
                  </span>
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-heading text-lg font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </PageContainer>
  );
}

function Door({
  icon,
  title,
  text,
  href,
  cta,
  primary = false,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  href: string;
  cta: string;
  primary?: boolean;
}) {
  return (
    <Card className={primary ? "ring-2 ring-primary" : undefined}>
      <CardHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary">{icon}</div>
        <CardTitle className="font-heading text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="text-base">{text}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1" />
      <CardFooter>
        <Link
          href={href}
          className={buttonVariants({ variant: primary ? "default" : "secondary", size: "lg", className: "h-11 w-full text-base" })}
        >
          {cta}
        </Link>
      </CardFooter>
    </Card>
  );
}
