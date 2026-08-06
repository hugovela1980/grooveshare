import type { Track } from "../types.js";

const TWO_CHANNEL_SLOT_COUNT = 2;

type ChannelSlot = {
    channelNumber: number;
    track: Track | null;
};

function createTwoChannelSlots(tracks: Track[]): ChannelSlot[] {
    return Array.from({ length: TWO_CHANNEL_SLOT_COUNT }, (_, index) => {
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
    <article class="mix-channel-slot" data-mix-channel="${slot.channelNumber}">
      <header class="mix-channel-slot__header">
        <h3 class="mix-channel-slot__title">Channel ${slot.channelNumber}</h3>
        <p class="mix-channel-slot__track-name">${track.name}</p>
      </header>

      <div class="mix-channel-slot__controls">
        <label class="mix-channel-slot__enabled-label">
          <input
            type="checkbox"
            data-channel-enabled
            data-track-id="${track.id}"
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
                data-track-id="${track.id}"
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
          data-track-id="${track.id}"
        >
          Delete
        </button>
      </div>
    </article>
  `;
}

function renderEmptyChannelSlot(channelNumber: number): string {
    return /*html*/ `
    <article class="mix-channel-slot mix-channel-slot--empty" data-mix-channel="${channelNumber}">
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
    </article>
  `;
}

export function renderTwoChannelMixSlots(tracks: Track[]): string {
    const slots = createTwoChannelSlots(tracks);

    return /*html*/ `
    <section class="mix-channel-slots" aria-label="Two channel mix setup">
      ${slots.map(renderAssignedChannelSlot).join("")}
    </section>
  `;
}