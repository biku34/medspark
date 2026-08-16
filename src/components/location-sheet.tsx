"use client";

import { useEffect, useState } from "react";
import { Crosshair, MapPin, Navigation } from "lucide-react";
import { Button, Field, Input, Modal } from "./ui";
import { useApp, type AppLocation } from "./providers";
import { CITIES, SERVICE_AREAS, areasFor } from "@/lib/zones";

/**
 * Location selector. Uses the browser Geolocation API when permitted and
 * falls back to a manual picker — every customer flow needs a location before
 * pharmacies can be matched.
 */
export function LocationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { location, setLocation, detectLocation, detecting, user, toast } = useApp();
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (open) setManual("");
  }, [open]);

  const choose = (l: AppLocation) => {
    setLocation(l);
    toast({ kind: "success", title: `Delivering to ${l.locality}` });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Delivery location">
      <div className="space-y-4">
        <Button
          full
          size="lg"
          loading={detecting}
          icon={<Crosshair size={18} />}
          onClick={async () => {
            const l = await detectLocation();
            if (l) onClose();
          }}
        >
          Use my current location
        </Button>

        <p className="text-center text-xs text-ink-400">
          We use your location only to find participating pharmacies near you.
        </p>

        {user?.savedLocations && user.savedLocations.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
              Saved locations
            </p>
            <div className="space-y-2">
              {user.savedLocations.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    choose({
                      locality: s.locality,
                      city: s.locality.split(", ")[1] ?? "",
                      address: s.address,
                      lat: s.lat,
                      lng: s.lng,
                      source: "saved",
                    })
                  }
                  className="flex w-full items-start gap-3 rounded-xl border border-ink-200 bg-white p-3 text-left hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <MapPin size={18} className="mt-0.5 shrink-0 text-brand-600" />
                  <span>
                    <span className="block text-sm font-semibold text-ink-800">{s.label}</span>
                    <span className="block text-xs text-ink-500">{s.address}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Field
            label="Or pick your area"
            hint="MedSpark is currently live in Gandhinagar and Ahmedabad."
          >
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="e.g. Sector 11, Navrangpura, Kudasan…"
            />
          </Field>

          {CITIES.map((city) => {
            const areas = areasFor(city).filter((a) =>
              manual ? a.name.toLowerCase().includes(manual.toLowerCase()) : true,
            );
            if (!areas.length) return null;
            return (
              <div key={city} className="mt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {city}
                </p>
                <div className="flex flex-wrap gap-2">
                  {areas.map((a) => (
                    <button
                      key={a.id}
                      onClick={() =>
                        choose({
                          locality: a.name,
                          city: a.city,
                          address: `${a.name}, ${a.city}`,
                          lat: a.lat,
                          lng: a.lng,
                          source: "manual",
                        })
                      }
                      className="rounded-full border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700 hover:border-brand-300 hover:bg-brand-50"
                    >
                      <Navigation size={12} className="mr-1 inline" />
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {manual.trim().length > 1 &&
            !SERVICE_AREAS.some((a) =>
              a.name.toLowerCase().includes(manual.trim().toLowerCase()),
            ) && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                No MedSpark area matches “{manual.trim()}”. We deliver in Gandhinagar and
                Ahmedabad today — more cities are coming.
              </p>
            )}
        </div>

        {location && (
          <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500">
            Currently delivering to{" "}
            <strong className="text-ink-700">
              {location.locality}
              {location.city && location.city !== "—" ? `, ${location.city}` : ""}
            </strong>
            {location.source === "gps" && " (detected)"}
          </p>
        )}
      </div>
    </Modal>
  );
}

/**
 * First-run permission prompt. Appears once until the customer answers, in line
 * with "on first use, ask for location permission".
 */
export function LocationPermissionGate() {
  const { locationAsked, location, detectLocation, detecting, markLocationAsked } = useApp();
  const [manualOpen, setManualOpen] = useState(false);

  if (locationAsked || location) {
    return <LocationSheet open={manualOpen} onClose={() => setManualOpen(false)} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-[2px]" />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl rise sm:rounded-3xl">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
          <MapPin size={28} className="text-brand-600" />
        </div>
        <h2 className="text-xl font-bold text-ink-900">Allow location access?</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          MedSpark finds medicines at <strong>verified pharmacies near you</strong> and shows
          real delivery times. We never share your location with anyone else.
        </p>
        <p className="mt-2 text-xs text-ink-500">
          Currently serving <strong className="text-ink-700">Gandhinagar</strong> and{" "}
          <strong className="text-ink-700">Ahmedabad</strong>.
        </p>
        <div className="mt-5 space-y-2">
          <Button
            full
            size="lg"
            loading={detecting}
            icon={<Crosshair size={18} />}
            onClick={() => void detectLocation()}
          >
            Use my current location
          </Button>
          <Button
            full
            size="lg"
            variant="outline"
            onClick={() => {
              markLocationAsked();
              setManualOpen(true);
            }}
          >
            Enter location manually
          </Button>
        </div>
      </div>
      <LocationSheet open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}
