issi<template>
  <AposModal
    :modal="modal"
    :modal-title="{ key: 'apostrophe:manageDocType', type: $t(moduleLabels.pluralLabel) }"
    class="apos-template-library-manager"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
    @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:exit"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposUtilityOperations
        :module-options="moduleOptions"
        :has-relationship-field="!!relationshipField"
      />
      <AposButton
        v-if="moduleOptions.canCreate"
        type="primary"
        :label="$t('aposTemplate:newTemplate')"
        @click="create"
      />
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyHeader>
          <AposDocsManagerToolbar
            :selected-state="selectAllState"
            :total-pages="totalPages"
            :current-page="currentPage"
            :filters="moduleOptions.filters"
            :filter-choices="filterChoices"
            :filter-values="filterValues"
            :labels="moduleLabels"
            :displayed-items="items.length"
            :checked="checked"
            :checked-count="checked.length"
            :batch-operations="moduleOptions.batchOperations"
            :module-name="moduleName"
            @page-change="updatePage"
            @select-click="selectClick"
            @search="onSearch"
            @filter="filter"
            @batch="handleBatchAction"
          />
        </template>
        <template #bodyMain>
          <AposTemplateManagerDisplay
            v-if="items.length"
            v-model:checked="checked"
            :items="items"
            :actions="actions"
            :max-reached="maxReached()"
            :options="{
              disableUnchecked: maxReached(),
              hideCheckboxes: false
            }"
            :generation="generation"
            @select="select"
            @select-series="selectSeries"
            @select-another="selectAnother"
            @click-action="clickAction"
          />
          <div
            v-else
            class="apos-pieces-manager__empty"
          >
            <AposEmptyState :empty-state="emptyDisplay" />
          </div>
        </template>
      </AposModalBody>
    </template>
  </AposModal>
</template>

<script>
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import { debounce } from 'Modules/@apostrophecms/ui/utils';

export default {
  name: 'AposTemplateLibraryManager',

  mixins: [ AposModifiedMixin, AposDocsManagerMixin ],

  props: {
    moduleName: {
      type: String,
      required: true
    }
  },

  emits: [ 'safe-close' ],

  data() {
    return {
      items: [],
      totalPages: 1,
      currentPage: 1,
      tagList: [],
      filterValues: {},
      filterChoices: {},
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      lastSelected: null,
      actions: [
        {
          name: 'editSettings',
          label: 'aposTemplate:editSettings'
        },
        {
          name: 'editLayout',
          label: 'aposTemplate:editLayout',
          if: {
            isPage: true,
            hasUrl: true
          }
        }
      ],
      generation: {}
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
    },
    moduleLabels() {
      if (!this.moduleOptions) {
        return null;
      }
      return {
        label: this.moduleOptions.label,
        pluralLabel: this.moduleOptions.pluralLabel
      };
    },
    selected() {
      return this.items.filter(item => this.checked.includes(item._id));
    },
    headers() {
      // Satisfy mixin requirement not actually applicable here
      return [];
    }
  },

  created() {
    this.moduleOptions.filters.forEach(({ name, def }) => {
      this.filterValues[name] = def;
    });

    const DEBOUNCE_TIMEOUT = 500;
    this.onSearch = debounce(this.search, DEBOUNCE_TIMEOUT);
  },

  async mounted() {
    this.modal.active = true;
    await this.getTemplates();

    apos.bus.$on('content-changed', this.onContentChanged);
    apos.bus.$on('command-menu-manager-create-new', this.create);
    apos.bus.$on('command-menu-manager-close', this.confirmAndCancel);
  },

  unmounted() {
    apos.bus.$off('content-changed', this.onContentChanged);
    apos.bus.$off('command-menu-manager-create-new', this.create);
    apos.bus.$off('command-menu-manager-close', this.confirmAndCancel);
  },

  methods: {
    async getTemplates() {
      const qs = {
        ...this.filterValues,
        page: this.currentPage
      };

      if (this.moduleOptions && Array.isArray(this.moduleOptions.filters)) {
        this.moduleOptions.filters.forEach(filter => {
          if (qs.choices) {
            qs.choices += `,${filter.name}`;
          } else {
            qs.choices = filter.name;
          }
        });
      }

      for (const prop in qs) {
        if (qs[prop] === undefined) {
          delete qs[prop];
        };
      }

      const {
        currentPage, pages, results, choices
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
      this.filterChoices = {
        ...this.filterChoices,
        _type: choices._type
      };
    },

    async filter(name, value) {
      this.filterValues[name] = value;
      this.currentPage = 1;

      await this.getTemplates();

      this.checked = [];
    },

    create() {
      this.editOrCreate(null);
    },

    async editOrCreate(piece) {
      await apos.modal.execute('AposTemplateLibraryEditor', {
        moduleName: this.moduleName,
        docId: piece?._id,
        type: piece?.type,
        filterValues: this.filterValues
      });
    },

    select(id) {
      this.checked = this.checked.includes(id) ? [] : [ id ];
      this.lastSelected = id;
    },

    selectAnother(id) {
      this.checked.includes(id)
        ? (this.checked = this.checked.filter(checkedId => checkedId !== id))
        : this.checked.push(id);

      this.lastSelected = id;
    },

    selectSeries(id) {
      if (!this.lastSelected) {
        this.select(id);
        return;
      }

      let beginIndex = this.items.findIndex(item => item._id === this.lastSelected);
      let endIndex = this.items.findIndex(item => item._id === id);
      const direction = beginIndex > endIndex ? -1 : 1;

      if (direction < 0) {
        [ beginIndex, endIndex ] = [ endIndex, beginIndex ];
      } else {
        endIndex++;
      }

      const sliced = this.items.slice(beginIndex, endIndex);
      sliced.forEach(item => {
        if (!this.checked.includes(item._id)) {
          this.checked.push(item._id);
        }
      });

      this.lastSelected = sliced[sliced.length - 1]._id;
    },

    clickAction({ action, item }) {
      if (action.name === 'editSettings') {
        this.editOrCreate(item);

        return;
      }

      if (action.name === 'editLayout') {
        window.location = item._url;
      }
    },

    selectClick() {
      this.selectAll();
    },

    async updatePage(num) {
      if (num) {
        this.currentPage = num;
        await this.getTemplates();
      }
    },

    async search(query) {
      this.filter('autocomplete', query);
    },

    async onContentChanged({ doc, action }) {
      if (action === 'update') {
        this.generation[doc._id] = (this.generation[doc._id] || 0) + 1;
      }
      await this.getTemplates();
    },

    async handleBatchAction({
      label, action, requestOptions = {}, messages
    }) {
      if (!action) {
        return;
      }

      try {
        await apos.http.post(`${this.moduleOptions.action}/${action}`, {
          body: {
            ...requestOptions,
            _ids: this.checked,
            messages,
            type: this.checked.length === 1
              ? this.moduleLabels.singular
              : this.moduleLabels.plural
          }
        });
      } catch {
        apos.notify('apostrophe:errorBatchOperationNoti', {
          interpolate: { operation: label },
          type: 'danger'
        });
      }
    }
  }
};
</script>
