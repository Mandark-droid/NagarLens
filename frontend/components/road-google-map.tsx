"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, MapPin } from "lucide-react";
import { useState } from "react";

import { DataBadge, Section } from "@/components/bits";
import { api } from "@/lib/api";

// Where the road is, on Google Maps. Keyless embed (no API key, nothing stored).
// Context only: the map is never joined to any record and no number on the page comes from it.
// Road names in the dataset are real; the segment coordinates are synthetic. So the default view searches
// Google Maps for the real road name, and the second view pins the place the dataset gives for this segment.

const embed = (q: string, zoom: number) => `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${zoom}&output=embed`;

export default function RoadGoogleMap({ road }: { road: any }) {
  const [view, setView] = useState<"name" | "segment">("name");
  const wards = useQuery({ queryKey: ["wards"], queryFn: () => api("/wards") });
  const wardName: string = wards.data?.rows?.find((w: any) => w.ward_code === road.ward_code)?.ward_name ?? "";
  const area = wardName.split(",")[0].trim();                       // "Matunga, Sion, Wadala" -> "Matunga"
  const search = [road.road_name, area, "Mumbai"].filter(Boolean).join(", ");

  const hasSegment = [road.start_lat, road.start_lon, road.end_lat, road.end_lon].every((v) => typeof v === "number");
  const mid = hasSegment ? `${((road.start_lat + road.end_lat) / 2).toFixed(6)},${((road.start_lon + road.end_lon) / 2).toFixed(6)}` : "";
  const src = view === "segment" && hasSegment ? embed(mid, 17) : embed(search, 15);

  const searchLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}`;
  const segmentLink = hasSegment
    ? `https://www.google.com/maps/dir/?api=1&origin=${road.start_lat},${road.start_lon}&destination=${road.end_lat},${road.end_lon}&travelmode=driving`
    : "";

  const tab = (key: "name" | "segment", label: string) => (
    <button
      type="button"
      onClick={() => setView(key)}
      aria-pressed={view === key}
      className={`min-h-9 rounded-full border px-3 py-1 text-[12.5px] font-semibold ${view === key ? "border-[#1E4FD8] bg-[#E3EBFD] text-[#17306E]" : "border-[#D5D6D0] bg-white text-[#2A2D33]"}`}
    >
      {label}
    </button>
  );

  return (
    <Section
      title="Where this road is"
      hint={view === "name" ? `Google Maps search for “${search}”.` : `The dataset's location for segment ${road.road_id} (${mid}).`}
      right={
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {/* the pin in "Dataset segment" is the organizer's synthetic coordinate; the basemap is third-party context */}
          {view === "segment" ? <DataBadge /> : null}
          <span className="inline-block whitespace-nowrap rounded-full bg-[#E7F1FB] px-2.5 py-0.5 text-[11px] font-bold text-[#17306E]">
            Google Maps · context only
          </span>
        </span>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {tab("name", "Road on Google Maps")}
        {hasSegment ? tab("segment", "Dataset segment") : null}
        <a href={searchLink} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1E4FD8] underline">
          <ExternalLink className="size-3.5" aria-hidden /> Open in Google Maps
        </a>
        {hasSegment ? (
          <a href={segmentLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#1E4FD8] underline">
            <MapPin className="size-3.5" aria-hidden /> Segment start to end
          </a>
        ) : null}
      </div>
      <iframe
        key={src}
        src={src}
        title={view === "name" ? `Google Map of ${search}` : `Google Map of the dataset location of segment ${road.road_id}`}
        className="h-[380px] w-full rounded-xl border border-[#D5D6D0] bg-[#EEF0F2]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <p className="mt-2 text-[12px] leading-relaxed text-[#454952]">
        The road name is real, so Google Maps can find the road itself. The segment coordinates in the dataset are synthetic: “Dataset
        segment” shows where the dataset places this segment, which may not sit exactly on the real road. The map is context only. No
        repair, bill or complaint on this page is taken from it.
      </p>
    </Section>
  );
}
