import type { Track } from "../types.js";

const MIX_CHANNEL_SLOT_COUNT = 4;

type ChannelSlot = {
  channelNumber: number;
  track: Track | null;
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
  return Array.from({ length: MIX_CHANNEL_SLOT_COUNT }, (_, index) => {
    return {
      channelNumber: index + 1,
      track: tracks[index] ?? null,
    };
  });
}

function renderAssignedChannelSlot(slot: ChannelSlot): string {
  const track = slot.track;

  if (!track) {
    return renderEmptyChannelSlot(slot.channelNumber);
  }

  return /*html*/ `
    <article
      class="mix-channel-slot"
      data-mix-channel-slot
      data-mix-channel="${slot.channelNumber}"
      data-track-id="${escapeHtml(track.id)}"
    >
      <div class="mix-channel-slot__channel-cell">
        <label class="mix-channel-slot__channel-toggle">
          <input
            class="mix-channel-slot__enabled-input"
            type="checkbox"
            data-channel-enabled
            data-track-id="${escapeHtml(track.id)}"
            aria-label="Enable channel ${slot.channelNumber}"
            checked
          />

          <span
            class="mix-channel-slot__channel-number"
            aria-hidden="true"
          >${slot.channelNumber}</span>
        </label>
      </div>

      <div class="mix-channel-slot__name-cell">
        <span class="mix-channel-slot__track-name">
          ${escapeHtml(track.name)}
        </span>
      </div>

      <div class="mix-channel-slot__volume-cell">
        <label class="mix-channel-slot__volume-label">
          <span class="mix-channel-slot__volume-value">100%</span>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="1"
            data-channel-volume
            data-track-id="${escapeHtml(track.id)}"
            aria-label="Channel ${slot.channelNumber} volume"
          />
        </label>
      </div>

      <div class="mix-channel-slot__timeline-cell">
        <div class="mix-channel-slot__waveform-placeholder">
          Waveform placeholder
        </div>
      </div>

      <div class="mix-channel-slot__actions">
        <button
          class="button button--danger"
          type="button"
          data-track-delete-button
          data-track-id="${escapeHtml(track.id)}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

function renderEmptyChannelSlot(channelNumber: number): string {
  return /*html*/ `
    <article
      class="mix-channel-slot mix-channel-slot--empty"
      data-mix-channel-slot
      data-mix-channel="${channelNumber}"
    >
      <div class="mix-channel-slot__channel-cell">
        <button
          class="button mix-channel-slot__add-track-button"
          type="button"
          data-track-add-button
          data-mix-channel="${channelNumber}"
        >
          Add Track
        </button>
      </div>

      <div class="mix-channel-slot__name-cell" aria-hidden="true"></div>
      <div class="mix-channel-slot__volume-cell" aria-hidden="true"></div>
      <div class="mix-channel-slot__timeline-cell" aria-hidden="true"></div>
      <div class="mix-channel-slot__actions" aria-hidden="true"></div>
    </article>
  `;
}

export function renderMixChannelSlots(tracks: Track[]): string {
  const slots = createMixChannelSlots(tracks);

  return /*html*/ `
    <section class="mix-channel-panel" aria-label="Four channel mix setup">
      <div class="mix-channel-panel__header">
        <div>
          <h3 class="mix-channel-panel__title">Mix Channels</h3>

          <p class="mix-channel-panel__description">
            Enable up to four tracks, set volume, then load the mix into the player.
          </p>
        </div>

        <button
          id="load-mix-button"
          class="button"
          type="button"
          data-load-mix-button
        >
          Load Mix
        </button>
      </div>

      <div class="mix-channel-grid-header" aria-hidden="true">
        <span>Channel</span>
        <span>Name</span>
        <span>Volume</span>
        <span>Timeline</span>
        <span></span>
      </div>

      <div class="mix-channel-slots">
        ${slots.map(renderAssignedChannelSlot).join("")}
      </div>
    </section>
  `;
}