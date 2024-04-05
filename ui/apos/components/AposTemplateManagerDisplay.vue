<template>
  <!-- Used for safely rendered image widgets -->
  <!-- eslint-disable vue/no-v-html -->
  <div class="apos-template-manager-display">
    <div class="apos-template-manager-display__grid">
      <div
        v-for="item in items"
        ref="grid"
        :key="`${item._id}${generation[item._id] || ''}`"
        :class="{ 'apos-is-selected': checked.includes(item._id) }"
        class="apos-template-manager-display__cell"
      >
        <div class="apos-template-manager-display__checkbox">
          <AposCheckbox
            v-show="!options.hideCheckboxes"
            v-model="checkedProxy"
            tabindex="-1"
            :field="{
              name: item._id,
              hideLabel: true,
              label: `Toggle selection of ${item.title}`,
              disableFocus: true,
              disabled: isDisabled(item._id) }"
            :choice="{ value: item._id }"
          />
        </div>
        <button
          :disabled="isDisabled(item._id)"
          class="apos-template-manager-display__select"
          @click.exact="$emit('select', item._id)"
          @click.shift="$emit('select-series', item._id)"
          @click.meta="$emit('select-another', item._id)"
        >
          <div class="apos-template-manager-display__browser-bar">
            <div class="apos-template-manager-display__browser-bar__dot" />
            <div class="apos-template-manager-display__browser-bar__dot" />
            <div class="apos-template-manager-display__browser-bar__dot" />
          </div>
          <div
            v-if="previewImages[item._id]"
            class="apos-template-manager-display__preview-img"
            v-html="previewImages[item._id]"
          />
          <div
            v-else-if="hasPreview(item)"
            class="apos-template-manager-display__preview"
          >
            <iframe
              :id="item.aposDocId"
              class="apos-template-manager-display__iframe"
              :src="getPreviewUrl(item)"
            />
          </div>
          <div
            v-else
            class="apos-template-manager-display__preview apos-template-manager-display__preview_placeholder"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="59.8"
              height="59.8"
            >
              <g
                fill="none"
                fill-rule="evenodd"
                stroke="#767676"
                stroke-width="1.8"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M53.9.9h-48a5 5 0 0 0-5 5v48a5 5 0 0 0 5 5h48a5 5 0 0 0 5-5v-48a5 5 0 0 0-5-5ZM.9 13.5h58M23.6 13.5v45.4M8.5 21.1h7.6M8.5 26.1h7.6M8.5 31.2h7.6M8.5 36.2h7.6M8.5 41.2h7.6M8.5 46.3h7.6M8.5 51.3h7.6"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M50 21H32.5c-.7 0-1.2.6-1.2 1.3v10.1c0 .7.5 1.3 1.2 1.3h17.7c.7 0 1.2-.6 1.2-1.3v-10c0-.8-.5-1.3-1.2-1.3ZM37.5 41.2h-5c-.8 0-1.3.6-1.3 1.3V45c0 .7.5 1.3 1.2 1.3h5c.8 0 1.3-.6 1.3-1.3v-2.5c0-.7-.5-1.3-1.2-1.3ZM50 41.2h-5c-.7 0-1.2.6-1.2 1.3V45c0 .7.5 1.3 1.2 1.3h5c.8 0 1.3-.6 1.3-1.3v-2.5c0-.7-.5-1.3-1.2-1.3Z"
                />
                <path d="M9.7 7.8a.6.6 0 0 1 0-1.2M9.7 7.8a.6.6 0 0 0 0-1.2M17.3 7.8a.6.6 0 0 1 0-1.2M17.3 7.8a.6.6 0 0 0 0-1.2M24.9 7.8a.6.6 0 0 1 0-1.2M24.9 7.8a.6.6 0 1 0 0-1.2" />
              </g>
            </svg>
            <p class="apos-template-manager-display__preview_placeholder_text">
              {{ $t('aposTemplate:previewUnavailable') }}
            </p>
          </div>
          <div class="apos-template-manager-display__actions">
            <AposButton
              v-for="action of getVisibleActions(item)"
              :key="action.name"
              type="default"
              :label="action.label"
              @click.stop="$emit('click-action', { action, item })"
            />
          </div>
        </button>
        <div class="apos-template-manager-display__info">
          <div class="apos-template-manager-display__info-title">
            {{ item.title }}
          </div>
          <div class="apos-template-manager-display__info-type">
            <span>{{ $t('apostrophe:type') }}:</span> {{ getModuleLabel(item.type) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AposTemplateManagerDisplay',
  props: {
    checked: {
      type: [ Array, Boolean ],
      default: () => []
    },
    items: {
      type: Array,
      default() {
        return [];
      }
    },
    options: {
      type: Object,
      default() {
        return {};
      }
    },
    actions: {
      type: Array,
      default() {
        return [];
      }
    },
    generation: {
      type: Object,
      default() {
        return {};
      }
    }
  },
  emits: [
    'select',
    'select-series',
    'select-another',
    'click-action',
    'update:checked'
  ],
  data: () => ({
    previewImages: {}
  }),
  computed: {
    // Handle the local check state within this component.
    checkedProxy: {
      get() {
        return this.checked;
      },
      set(val) {
        this.$emit('update:checked', val);
      }
    }
  },
  watch: {
    items: {
      async handler() {
        await this.getPreviewImages();
      }
    }
  },
  async created() {
    await this.getPreviewImages();
  },
  methods: {
    isDisabled(id) {
      return this.options.disableUnchecked && !this.checked.includes(id);
    },
    getModuleLabel(type) {
      return this.$t(apos.modules[type] && apos.modules[type].label);
    },
    hasPreview(item) {
      return item._url && !item.archived;
    },
    getPreviewUrl(item) {
      return `${item._url}?aposRefresh=1&iframe=1`;
    },

    async getPreviewImages() {
      const promises = this.items.reduce((acc, item) => {
        if (!item.aposPreviewImage || !item.aposPreviewImage.items.length) {
          return acc;
        }

        return [
          ...acc,
          new Promise((resolve) => {
            this.renderPreviewImage(item).then((imgHtml) => {
              resolve([ item._id, imgHtml ]);
            });
          })
        ];
      }, []);

      this.previewImages = Object.fromEntries(
        await Promise.all(promises)
      );
    },
    async renderPreviewImage(item) {
      const previewImageField = apos.modules['@apostrophecms-pro/doc-template-library'].schema
        .find(({ name }) => name === 'aposPreviewImage');
      const [ widget ] = item.aposPreviewImage.items;

      const body = {
        _docId: item._id,
        widget,
        areaFieldId: previewImageField._id,
        type: widget.type
      };

      const imgHtml = await apos.http.post(`${apos.area.action}/render-widget?aposEdit=1&aposMode=draft`, {
        busy: true,
        body
      });

      return imgHtml;
    },
    getVisibleActions(item) {
      const checkCondition = condition => {
        const isPage = (condition.isPage && item.slug.startsWith('/')) ?? true;
        const hasUrl = (condition.hasUrl && item._url) ?? true;

        return isPage && hasUrl;
      };

      return this.actions.filter(action => !action.if || checkCondition(action.if));
    }
  }
};
</script>

<style lang="scss" scoped>

.apos-template-manager-display {
  --scale-ratio: 3;

  @include type-base;
  container-type: inline-size;
}

.apos-template-manager-display__grid {
  display: grid;
  grid-auto-rows: 440px;
  grid-template-columns: repeat(3, 30%);
  gap: 80px 5%;

  @container (width > 1200px) {
    grid-template-columns: repeat(4, 22%);
    gap: 80px 4%;
  }
}

.apos-template-manager-display__cell {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  @include apos-transition();

  &.apos-is-hidden {
    visibility: hidden;
  }

  &:hover {
    .apos-template-manager-display__actions {
      opacity: 1;
      background-color: rgba(33, 8, 72, 0.8);
      pointer-events: auto;
    }
  }

  &.apos-is-selected {
    .apos-template-manager-display__select {
      outline: 4px solid var(--a-primary);
      outline-offset: -2px;
    }
  }
}

.apos-template-manager-display__checkbox {
  z-index: $z-index-manager-display;
  position: absolute;
  top: 18px;
  left: 18px;
  opacity: 0;

  @include apos-transition();
  :deep(.apos-input--checkbox:checked + .apos-input-indicator) {
    background-color: var(--a-primary);
    box-shadow: 0 0 10px var(--a-primary);
  }
  :deep(.apos-input-indicator) {
    padding: 2px;
    border: 1px solid var(--a-base-6);
    outline: 5px solid var(--a-white);
    background-color: var(--a-base-10);
  }
}

.apos-template-manager-display__cell:hover .apos-template-manager-display__checkbox,
.apos-template-manager-display__cell.apos-is-selected .apos-template-manager-display__checkbox {
  opacity: 1;
}

.apos-template-manager-display__preview {
  position: absolute;
  top: 12px;
  width: 100%;
  height: 100%;
  padding: 0;
  pointer-events: none;

  @include apos-transition();

}

.apos-template-manager-display__preview-img {
  position: absolute;
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0;
  pointer-events: none;
  justify-content: center;
  align-items: center;
  z-index: -1;

  :deep(.bp-image-widget) {
    max-height: 100%;
    max-width: 100%;
  }
}

.apos-template-manager-display__iframe {
  border: none;
  transform-origin: 0 0;
  width: calc(100% * var(--scale-ratio));
  height: calc(375px * var(--scale-ratio));
  transform: scale(calc(1 / (1 * var(--scale-ratio))));
}

.apos-template-manager-display__preview_placeholder {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.apos-template-manager-display__preview_placeholder_text {
  margin-top: 5px;
}

.apos-template-manager-display__select {
  @include apos-button-reset();
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 4 / 3;
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: var(--a-border-radius);
  box-shadow: var(--a-box-shadow);
  overflow: hidden;
  border: 1px solid var(--a-base-9);
  @include apos-transition();

  &:active + .apos-template-manager-display__checkbox {
    opacity: 1;
  }

  &[disabled] {
    cursor: not-allowed;
  }
}

.apos-template-manager-display__actions {
  opacity: 0;
  display: flex;
  width: 100%;
  height: 100%;
  justify-content: center;
  align-items: center;
  gap: 15px;
  position: absolute;
  border-radius: var(--a-border-radius);
  @include apos-transition();
  pointer-events: none;

  :deep(.apos-button) {
    padding: 10px;
  }
}

.apos-template-manager-display__info {
  margin-top: $spacing-base;
  align-self: start;

  .apos-template-manager-display__info-title {
    @include type-large;
    margin-bottom: 5px;
    font-size: 18px;
  }
  .apos-template-manager-display__info-type {
    @include type-base;
    color: var(--a-base-1);
  }
}

.apos-template-manager-display__browser-bar {
  background-color: var(--a-base-8);
  align-self: flex-start;
  width: 100%;
  height: 12px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 3px;
  padding: 0 8px;
  border-radius: 4px 4px 0 0;

  &__dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--a-base-4);
  }
}
</style>
