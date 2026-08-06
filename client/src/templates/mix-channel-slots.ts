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
      <header class="mix-channel-slot__header">
        <h3 class="mix-channel-slot__title">Channel ${slot.channelNumber}</h3>
        <p class="mix-channel-slot__track-name">${escapeHtml(track.name)}</p>
      </header>

      <div class="mix-channel-slot__controls">
        <label class="mix-channel-slot__enabled-label">
          <input
            type="checkbox"
            data-channel-enabled
            data-track-id="${escapeHtml(track.id)}"
            checked
          />
          Enabled
        </label>

        <label class="mix-channel-slot__volume-label">
          Volume
          <span class="mix-channel-slot__volume-value">100%</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value="1"
            data-channel-volume
            data-track-id="${escapeHtml(track.id)}"
          />
        </label>
      </div>

      <div class="mix-channel-slot__waveform-placeholder">
        Waveform placeholder
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
      <header class="mix-channel-slot__header">
        <h3 class="mix-channel-slot__title">Channel ${channelNumber}</h3>
        <p class="mix-channel-slot__track-name">Empty slot</p>
      </header>

      <div class="mix-channel-slot__controls">
        <p class="empty-state">No track assigned.</p>
      </div>

      <div class="mix-channel-slot__waveform-placeholder">
        Waveform placeholder
      </div>

      <div class="mix-channel-slot__actions">
        <button
          class="button"
          type="button"
          data-track-add-button
          data-mix-channel="${channelNumber}"
        >
          Add Track
        </button>
      </div>
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

      <div class="mix-channel-slots">
        ${slots.map(renderAssignedChannelSlot).join("")}
      </div>
    </section>
  `;
}