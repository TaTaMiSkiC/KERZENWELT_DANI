import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if user already accepted cookies
    const cookieConsent = localStorage.getItem("cookieConsent");
    if (!cookieConsent) {
      setOpen(true);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem(
      "cookieConsent",
      JSON.stringify({
        necessary: true,
        functional: true,
        analytics: true,
        marketing: true,
        timestamp: new Date().toISOString(),
      }),
    );
    setOpen(false);
  };

  const savePreferences = () => {
    localStorage.setItem(
      "cookieConsent",
      JSON.stringify({
        ...preferences,
        timestamp: new Date().toISOString(),
      }),
    );
    setSettingsOpen(false);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white shadow-lg p-4 flex flex-col md:flex-row justify-between items-center z-50">
        <div className="mb-4 md:mb-0 md:mr-4">
          <p className="text-text-dark">
            <strong>Wir verwenden Cookies</strong> -Um Ihnen die bestmögliche
            Erfahrung bei der Nutzung unserer Website zu bieten.
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => {
              setSettingsOpen(true);
              setOpen(false);
            }}
          >
            Einstellungen
          </Button>
          <Button onClick={acceptAll}>Akzeptiere alles</Button>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Postavke kolačića</DialogTitle>
            <DialogDescription>
              Prilagodite koje kolačiće želite prihvatiti. Nužni kolačići su
              obavezni za funkcioniranje stranice.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-start space-x-3">
              <Checkbox id="necessary" checked disabled />
              <div className="space-y-1 leading-none">
                <Label htmlFor="necessary" className="font-medium">
                  Nužni kolačići
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ovi kolačići su neophodni za funkcioniranje stranice i ne mogu
                  se isključiti.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="functional"
                checked={preferences.functional}
                onCheckedChange={(checked) =>
                  setPreferences({
                    ...preferences,
                    functional: checked === true,
                  })
                }
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="functional" className="font-medium">
                  Funkcionalni kolačići
                </Label>
                <p className="text-sm text-muted-foreground">
                  Omogućuju napredne funkcionalnosti i personalizaciju.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="analytics"
                checked={preferences.analytics}
                onCheckedChange={(checked) =>
                  setPreferences({
                    ...preferences,
                    analytics: checked === true,
                  })
                }
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="analytics" className="font-medium">
                  Analitički kolačići
                </Label>
                <p className="text-sm text-muted-foreground">
                  Pomažu nam razumjeti kako koristite našu stranicu.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="marketing"
                checked={preferences.marketing}
                onCheckedChange={(checked) =>
                  setPreferences({
                    ...preferences,
                    marketing: checked === true,
                  })
                }
              />
              <div className="space-y-1 leading-none">
                <Label htmlFor="marketing" className="font-medium">
                  Marketinški kolačići
                </Label>
                <p className="text-sm text-muted-foreground">
                  Koriste se za praćenje posjetitelja na web stranicama radi
                  prikaza relevantnih oglasa.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Odustani
            </Button>
            <Button onClick={savePreferences}>Spremi postavke</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
