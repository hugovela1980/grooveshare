import { canContribute } from "@hugovela/frontend-core";
import type {
  MixSettings,
  MusicalTimeline,
  ProjectRole,
  Track,
} from "../types.js";

const MIX_CHANNEL_SLOT_COUNT = 4;

type ChannelSlot = {
  channelNumber: number;
  track: Track | null;
};

export type MixChannelRenderContext = {
  role: ProjectRole;
  currentUserId: string | null;
  musicalTimeline?: MusicalTimeline;
};

const DEFAULT_RENDER_CONTEXT: MixChannelRenderContext = {
  role: "owner",
  currentUserId: null,
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createMixChannelSlots(tracks: Track[]): ChannelSlot[] {
  return Array.from({ length: MIX_CHANNEL_SLOT_COUNT }, (_, index) => ({
    channelNumber: index + 1,
    track: tracks[index] ?? null,
  }));
}

function renderAssignedChannelSlot(
  slot: ChannelSlot,
  mixSettings: MixSettings | undefined,
): string {
  const track = slot.track!;
  const saved = mixSettings?.channels.find((channel) => channel.trackId === track.id);
  const enabled = saved?.enabled ?? true;
  const volume = saved?.volume ?? 1;
  const percentage = Math.round(volume * 100);

  return /*html*/ `
    <article
      class="mix-channel-slot"
      data-mix-channel-slot
      data-mix-channel="${slot.channelNumber}"
      data-track-id="${escapeHtml(track.id)}"
    >
      <div class="mix-channel-slot__strip">
        <span
          class="mix-channel-slot__track-name"
          data-track-name-display
          data-track-id="${escapeHtml(track.id)}"
        >${escapeHtml(track.name)}</span>

        <label class="mix-channel-slot__volume-label">
          <span
            class="mix-channel-slot__volume-value"
            data-channel-volume-value
            data-mix-channel="${slot.channelNumber}"
          >${percentage}%</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="${volume}"
            data-channel-volume
            data-mix-channel="${slot.channelNumber}"
            data-track-id="${escapeHtml(track.id)}"
            aria-label="Channel ${slot.channelNumber} volume"
          />
        </label>

        <label class="mix-channel-slot__channel-toggle">
          <input
            class="mix-channel-slot__enabled-input"
            type="checkbox"
            data-channel-enabled
            data-mix-channel="${slot.channelNumber}"
            data-track-id="${escapeHtml(track.id)}"
            aria-label="Enable channel ${slot.channelNumber}"
            ${enabled ? "checked" : ""}
          />
          <span class="mix-channel-slot__enabled-state" aria-hidden="true">
            <span class="mix-channel-slot__state-on">On</span>
            <span class="mix-channel-slot__state-off">Off</span>
          </span>
        </label>
      </div>
    </article>
  `;
}

function renderEmptyChannelSlot(
  channelNumber: number,
  context: MixChannelRenderContext,
): string {
  const content = canContribute(context.role)
    ? `<button class="mix-channel-slot__add-track-button" type="button" data-track-add-button data-mix-channel="${channelNumber}" aria-label="Add track to channel ${channelNumber}">+<span>Add track</span></button>`
    : '<span class="mix-channel-slot__empty-label">Empty</span>';

  return /*html*/ `
    <article class="mix-channel-slot mix-channel-slot--empty" data-mix-channel-slot data-mix-channel="${channelNumber}">
      <div class="mix-channel-slot__strip">${content}</div>
    </article>
  `;
}

export function renderMixChannelSlots(
  tracks: Track[],
  mixSettings?: MixSettings,
  context: MixChannelRenderContext = DEFAULT_RENDER_CONTEXT,
): string {
  return /*html*/ `
    <section class="mix-channel-panel" aria-labelledby="mix-channel-heading">
      <h2 id="mix-channel-heading" class="mix-channel-panel__title">Mix</h2>
      <div class="mix-channel-slots" tabindex="0" role="region" aria-label="Mix channels">
        ${createMixChannelSlots(tracks)
          .map((slot) => slot.track
            ? renderAssignedChannelSlot(slot, mixSettings)
            : renderEmptyChannelSlot(slot.channelNumber, context))
          .join("")}
      </div>
    </section>
  `;
}
