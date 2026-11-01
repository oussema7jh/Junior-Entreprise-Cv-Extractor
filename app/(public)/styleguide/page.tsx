// Every shared component in the club style, so members copy from here instead of rewriting.
// Open /styleguide. When you add a component to components/ui/, add it here too.
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageContainer } from "@/components/site/page-container";
import { getTranslations } from "next-intl/server";
import { ToastDemo } from "./toast-demo";


const colours = [
  ["primary", "bg-primary"],
  ["secondary", "bg-secondary"],
  ["accent", "bg-accent"],
  ["muted", "bg-muted"],
  ["destructive", "bg-destructive"],
  ["border", "bg-border"],
  ["foreground", "bg-foreground"],
  ["background", "bg-background"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function StyleguidePage() {
  const t = await getTranslations("styleguide");
  return (
    <PageContainer className="gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <Section title={t("colours")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {colours.map(([name, className]) => (
            <div key={name} className="flex flex-col gap-1.5">
              <div className={`h-12 rounded-lg border ${className}`} />
              <code className="text-xs text-muted-foreground">{name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("typography")}>
        <p className="font-heading text-3xl font-semibold">{t("headingSample")}</p>
        <p>{t("bodySample")}</p>
        <p className="text-sm text-muted-foreground">{t("bodySample")}</p>
      </Section>

      <Section title={t("buttons")}>
        <div className="flex flex-wrap gap-2">
          <Button>default</Button>
          <Button variant="secondary">secondary</Button>
          <Button variant="outline">outline</Button>
          <Button variant="ghost">ghost</Button>
          <Button variant="destructive">destructive</Button>
          <Button variant="link">link</Button>
          <Button disabled>disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button>default</Button>
          <Button size="lg">lg</Button>
        </div>
      </Section>

      <Section title={t("forms")}>
        <div className="grid max-w-md gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sg-email">{t("emailLabel")}</Label>
            <Input id="sg-email" type="email" placeholder={t("emailPlaceholder")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sg-message">{t("messageLabel")}</Label>
            <Textarea id="sg-message" placeholder={t("messagePlaceholder")} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("lookingForLabel")}</Label>
            <Select>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("lookingForPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pfe">{t("pfe")}</SelectItem>
                <SelectItem value="internship">{t("internship")}</SelectItem>
                <SelectItem value="job">{t("job")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox />
            {t("consent")}
          </Label>
        </div>
      </Section>

      <Section title={t("cardsBadges")}>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{t("cardTitle")}</CardTitle>
            <CardDescription>{t("cardDescription")}</CardDescription>
          </CardHeader>
          <CardContent>{t("cardBody")}</CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Badge>{t("badgeDefault")}</Badge>
            <Badge variant="secondary">{t("badgeSecondary")}</Badge>
            <Badge variant="outline">{t("badgeOutline")}</Badge>
            <Badge variant="destructive">{t("badgeDestructive")}</Badge>
          </CardFooter>
        </Card>
      </Section>

      <Section title={t("overlays")}>
        <div className="flex flex-wrap gap-2">
          <Dialog>
            <DialogTrigger render={<Button />}>{t("openDialog")}</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("dialogTitle")}</DialogTitle>
                <DialogDescription>{t("dialogDescription")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
                <DialogClose render={<Button />}>{t("confirm")}</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ToastDemo label={t("showToast")} message={t("toastMessage")} />
        </div>
      </Section>

      <Section title={t("tabs")}>
        <Tabs defaultValue="one" className="max-w-md">
          <TabsList>
            <TabsTrigger value="one">{t("tabOne")}</TabsTrigger>
            <TabsTrigger value="two">{t("tabTwo")}</TabsTrigger>
          </TabsList>
          <TabsContent value="one" className="text-sm">{t("tabOneBody")}</TabsContent>
          <TabsContent value="two" className="text-sm">{t("tabTwoBody")}</TabsContent>
        </Tabs>
      </Section>

      <Section title={t("layout")}>
        <p className="text-sm text-muted-foreground">{t("layoutBody")}</p>
      </Section>
    </PageContainer>
  );
}
