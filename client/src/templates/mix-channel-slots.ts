import {
    canContribute,
    canManageTrack,
} from "@hugovela/frontend-core";
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
    return Array.from(
        { length: MIX_CHANNEL_SLOT_COUNT },
        (_, index) => ({
            channelNumber: index + 1,
            track: tracks[index] ?? null,
        }),
    );
}

function renderAssignedChannelSlot(
    slot: ChannelSlot,
    mixSettings: MixSettings | undefined,
    context: MixChannelRenderContext,
): string {
    const track = slot.track;

    if (!track) {
        return renderEmptyChannelSlot(slot.channelNumber, context);
    }

    const savedChannelSetting = mixSettings?.channels.find((channel) => {
        return channel.trackId === track.id;
    });

    const isEnabled = savedChannelSetting?.enabled ?? true;
    const volume = savedChannelSetting?.volume ?? 1;
    const volumePercentage = Math.round(volume * 100);
    const mayManageTrack = canManageTrack({
        role: context.role,
        currentUserId: context.currentUserId,
        track,
    });

    const trackNameMarkup = mayManageTrack
        ? /*html*/ `
            <span
              class="mix-channel-slot__track-name mix-channel-slot__track-name--editable"
              contenteditable="true"
              role="textbox"
              aria-label="Edit track name for channel ${slot.channelNumber}"
              spellcheck="false"
              data-track-name-editor
              data-track-name-display
              data-track-id="${escapeHtml(track.id)}"
            >${escapeHtml(track.name)}</span>
          `
        : /*html*/ `
            <span
              class="mix-channel-slot__track-name"
              data-track-name-display
              data-track-id="${escapeHtml(track.id)}"
            >${escapeHtml(track.name)}</span>
          `;

    return /*html*/ `
      <article
        class="mix-channel-slot"
        data-mix-channel-slot
        data-mix-channel="${slot.channelNumber}"
        data-track-id="${escapeHtml(track.id)}"
      >
        <div class="mix-channel-slot__strip">
          <div class="mix-channel-slot__name-cell">
            <div
              class="mix-channel-slot__editable-name${mayManageTrack
                  ? " mix-channel-slot__editable-name--enabled"
                  : ""}"
            >
              ${trackNameMarkup}
            </div>
          </div>

          <div class="mix-channel-slot__volume-cell">
            <label class="mix-channel-slot__volume-label">
              <span
                class="mix-channel-slot__volume-value"
                data-channel-volume-value
                data-mix-channel="${slot.channelNumber}"
              >${volumePercentage}%</span>
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
          </div>

          <div class="mix-channel-slot__channel-cell">
            <label class="mix-channel-slot__channel-toggle">
              <input
                class="mix-channel-slot__enabled-input"
                type="checkbox"
                data-channel-enabled
                data-mix-channel="${slot.channelNumber}"
                data-track-id="${escapeHtml(track.id)}"
                aria-label="Enable channel ${slot.channelNumber}"
                ${isEnabled ? "checked" : ""}
              />
              <span class="mix-channel-slot__channel-number" aria-hidden="true">
                ${slot.channelNumber} · <span class="mix-channel-slot__state-on">On</span><span class="mix-channel-slot__state-off">Off</span>
              </span>
            </label>
          </div>
        </div>
        <div class="mix-channel-slot__actions">
          ${mayManageTrack
              ? /*html*/ `
                  <button
                    class="button button--danger mix-channel-slot__delete-button"
                    type="button"
                    data-track-delete-button
                    data-track-id="${escapeHtml(track.id)}"
                    aria-label="Delete track ${escapeHtml(track.name)}"
                  >Delete</button>
                `
              : ""}
        </div>
      </article>
    `;
}

function renderEmptyChannelSlot(
    channelNumber: number,
    context: MixChannelRenderContext,
): string {
    const addTrackMarkup = canContribute(context.role)
        ? /*html*/ `
            <button
              class="button mix-channel-slot__add-track-button"
              type="button"
              data-track-add-button
              data-mix-channel="${channelNumber}"
            >Add Track</button>
          `
        : '<span class="mix-channel-slot__empty-label">Empty</span>';

    return /*html*/ `
      <article
        class="mix-channel-slot mix-channel-slot--empty"
        data-mix-channel-slot
        data-mix-channel="${channelNumber}"
      >
        <div class="mix-channel-slot__strip">
          <div class="mix-channel-slot__channel-cell">
            ${addTrackMarkup}
          </div>
          <div class="mix-channel-slot__name-cell" aria-hidden="true"></div>
          <div class="mix-channel-slot__volume-cell" aria-hidden="true"></div>
        </div>
        <div class="mix-channel-slot__actions" aria-hidden="true"></div>
      </article>
    `;
}

export function renderMixChannelSlots(
    tracks: Track[],
    mixSettings?: MixSettings,
    context: MixChannelRenderContext = DEFAULT_RENDER_CONTEXT,
): string {
    const slots = createMixChannelSlots(tracks);

    return /*html*/ `
      <section class="mix-channel-panel" aria-label="Four channel mix setup">
        <div class="mix-channel-panel__header">
          <div>
            <h3 class="mix-channel-panel__title">Mix</h3>
            <p class="mix-channel-panel__description">
              Toggle tracks and adjust volume.
            </p>
          </div>
        </div>

        <div class="mix-channel-slots" tabindex="0" role="region" aria-label="Mix channels">
          ${slots
              .map((slot) => {
                  return renderAssignedChannelSlot(
                      slot,
                      mixSettings,
                      context,
                  );
              })
              .join("")}
        </div>
      </section>
    `;
}
