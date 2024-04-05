<template>
  <div>
    <AposModalToolbar
      class-name="apos-template-list-toolbar"
    >
      <template #rightControls>
        <AposPager
          v-if="totalPages !== 0"
          :total-pages="totalPages"
          :current-page="currentPage"
          @click="updatePage"
          @change="updatePage"
        />
        <AposInputString
          :field="searchField.field"
          :status="searchField.status"
          :model-value="searchField.value"
          :modifiers="['small']"
          @update:model-value="onSearch"
          @return="onSearch($event, true)"
        />
      </template>
    </AposModalToolbar>
    <AposTemplateManagerDisplay
      v-if="items.length"
      v-model:checked="checked"
      :items="items"
      :actions="actions"
      :max-reached="maxReached()"
      :options="{
        disableUnchecked: maxReached(),
        hideCheckboxes: true
      }"
      @select="change"
      @click-action="clickAction"
    />
    <div
      v-else
      class="apos-template-list__empty"
    >
      <AposEmptyState :empty-state="emptyDisplay" />
    </div>
  </div>
</template>

<script>
import AposInputMixin from 'Modules/@apostrophecms/schema/mixins/AposInputMixin';
import { debounce } from 'Modules/@apostrophecms/ui/utils';

export default {
  mixins: [ AposInputMixin ],
  emits: [ 'update-doc-data' ],
  data() {
    return {
      moduleName: '',
      checked: [],
      items: [],
      totalPages: 1,
      currentPage: 1,
      filterValues: {},
      actions: [
        {
          name: 'applyTemplate',
          label: 'aposTemplate:applyTemplate'
        }
      ],
      searchField: {
        field: {
          name: 'search',
          type: 'string',
          placeholder: {
            key: 'apostrophe:searchDocType',
            type: this.$t(window.apos.modules[this.moduleName]?.pluralLabel)
          },
          icon: 'magnify-icon',
          enterSubmittable: true
        },
        status: {},
        value: { data: '' }
      }
    };
  },
  computed: {
    moduleOptions() {
      return window.apos.modules[this.moduleName];
    },
    emptyDisplay() {
      return {
        title: {
          key: 'apostrophe:noTypeFound',
          type: this.$t(this.moduleOptions?.pluralLabel || this.moduleOptions?.label)
        },
        message: '',
        emoji: '📄'
      };
    }
  },
  watch: {
    'field.moduleName': {
      async handler(newVal, oldVal) {
        if (newVal === oldVal) {
          return;
        }

        this.moduleName = this.field.moduleName;
        await this.getTemplates();
      }
    }
  },
  created() {
    const DEBOUNCE_TIMEOUT = 500;
    this.onSearch = debounce(this.search, DEBOUNCE_TIMEOUT);
  },
  async mounted() {
    this.moduleName = this.field.moduleName;
    await this.getTemplates();
  },
  methods: {
    validate(value) {
      if (this.field.required && !value.length) {
        return { message: 'required' };
      }

      return false;
    },
    maxReached() {
      return this.checked.length > 1;
    },
    clickAction({ action, item }) {
      if (action.name === 'applyTemplate') {
        this.change(item._id);
      }
    },
    async change(id) {
      this.checked = [ id ];
      const {
        title,
        slug,
        visibility,
        ...complete
      } = await apos.http.get(`${this.moduleOptions.action}/${id}`, {
        busy: true,
        qs: {
          displayTemplate: true
        }
      });

      this.$emit('update-doc-data', {
        data: {
          ...complete,
          copyOfId: id,
          aposIsTemplate: false
        },
        fieldState: {}
      });

      apos.notify('aposTemplate:templateApplied', {
        type: 'success',
        dismiss: true,
        icon: 'palette-advanced-icon'
      });
    },

    async getTemplates() {
      if (this.docId) {
        // templates should be availables only in create mode
        return;
      }

      const qs = {
        ...this.filterValues,
        type: this.moduleName,
        displayTemplate: true,
        page: this.currentPage || 1
      };

      const {
        results = [],
        pages = 1,
        currentPage = 1
      } = await apos.http.get(
        this.moduleOptions.action, {
          busy: true,
          qs,
          draft: true
        }
      );

      this.currentPage = currentPage;
      this.totalPages = pages;
      this.items = results;
    },
    async updatePage(pageNum) {
      if (!pageNum) {
        return;
      }

      this.currentPage = pageNum;
      await this.getTemplates();
    },
    async search(value, force) {
      if ((force && !value) || value.data === '') {
        value = {
          data: '',
          error: false
        };
      } else if (!value || value.error || (!force && value.data.length < 3)) {
        return;
      }

      this.filterValues.autocomplete = value.data;
      this.currentPage = 1;

      await this.getTemplates();
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-template-list-toolbar {
  :deep() { // Not sure about this syntax
    margin-bottom: $spacing-double;
  }

  :deep(.apos-field--search) {
    width: 250px;
  }

  :deep(.apos-input) {
    height: 32px;
  }
}
</style>
