<template>
  <AposModal ref="modal" :modal="modal" :modal-title="modalTitle" @esc="confirmAndCancel"
    @no-modal="$emit('safe-close')" @inactive="modal.active = false" @show-modal="modal.showModal = true">
    <template #secondaryControls>
      <AposButton type="default" label="apostrophe:exit" @click="confirmAndCancel" />
    </template>
    <template #primaryControls>
      <AposUtilityOperations :module-options="moduleOptions" :has-relationship-field="!!relationshipField" />
    </template>
    <template #main>
      <div style="display: flex;">
        <AposModalBody>
          <template #bodyHeader>
            <AposDocsManagerToolbar :selected-state="selectAllState" :total-pages="totalPages"
              :current-page="currentPage" :filter-choices="filterChoices" :filter-values="filterValues"
              :filters="moduleOptions.filters" :labels="moduleLabels" :displayed-items="items.length"
              :is-relationship="!!relationshipField" :checked="checked" :checked-count="checked.length"
              :batch-operations="moduleOptions.batchOperations" :module-name="moduleName" :options="{
    disableUnchecked: maxReached()
  }" @select-click="selectAll" @search="onSearch" @page-change="updatePage" @filter="filter"
              @batch="handleBatchAction" />
            <AposDocsManagerSelectBox :selected-state="selectAllState" :module-labels="moduleLabels"
              :filter-values="filterValues" :checked-ids="checked" :all-pieces-selection="allPiecesSelection"
              :displayed-items="items.length" @select-all="selectAllPieces"
              @set-all-pieces-selection="setAllPiecesSelection" />
          </template>
          <template #bodyMain>
            <AposLiveChatManagerDisplay :key="refreshKey" v-if="items.length > 0" v-model:checked="checked"
              :items="items" :headers="headers" :options="{
    ...moduleOptions,
    disableUnchecked: maxReached(),
    disableUnpublished: disableUnpublished,
    manuallyPublished: manuallyPublished
  }" :current-chat="currentChat" @open="edit" />
            <div v-else class="apos-pieces-manager__empty">
              <AposEmptyState :empty-state="emptyDisplay" />
            </div>
          </template>
        </AposModalBody>
        <AposLiveChatMessenger :key="refreshKey" :chat="currentChat" @chat-updated="handleChatUpdated" />
      </div>
    </template>
  </AposModal>
</template>

<script>
import AposDocsManagerMixin from 'Modules/@apostrophecms/modal/mixins/AposDocsManagerMixin';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import { debounce } from 'Modules/@apostrophecms/ui/utils';
import { io } from 'socket.io-client'

export default {
  name: 'AposLiveChatManager',
  mixins: [
    AposDocsManagerMixin, AposModifiedMixin, AposPublishMixin
  ],
  props: {
    moduleName: {
      type: String,
      required: true
    }
  },
  emits: ['archive', 'safe-close'],
  data() {
    return {
      modal: {
        active: false,
        triggerFocusRefresh: 0,
        type: 'overlay',
        showModal: false
      },
      headers: [],
      items: [],
      lastSelected: null,
      totalPages: 1,
      currentPage: 1,
      filterValues: {},
      queryExtras: {
        viewContext: this.relationshipField ? 'relationship' : 'manage'
      },
      holdQueries: false,
      filterChoices: {},
      allPiecesSelection: {
        isSelected: false,
        total: 0
      },
      refreshKey: 0,
      currentChat: null,
      socket: null,
    };
  },
  computed: {
    moduleOptions() {
      return {
        ...window.apos.modules[this.moduleName],
        batchOperations: window.apos.modules[this.moduleName].batchOperations.filter(op => op.action !== 'publish'),
        showCreate: false
      };
    },
    moduleLabels() {
      return {
        singular: this.moduleOptions.label,
        plural: this.moduleOptions.pluralLabel
      };
    },
    saveRelationshipLabel() {
      if (this.relationshipField && (this.relationshipField.max === 1)) {
        return {
          key: 'apostrophe:selectOneLabel',
          typeLabel: this.$t(this.moduleLabels.label)
        };
      } else {
        return {
          key: 'apostrophe:selectManyLabel',
          typeLabel: this.$t(this.moduleLabels.pluralLabel)
        };
      }
    },
    modalTitle() {
      const verb = this.relationshipField ? 'choose' : 'manage';
      return {
        key: (verb === 'choose') ? 'apostrophe:chooseDocType' : 'apostrophe:manageDocType',
        type: this.$t(this.moduleLabels.plural)
      };
    },
    emptyDisplay() {
      return {
        title: {
          key: 'apostrophe:noTypeFound',
          type: this.$t(this.moduleLabels.plural || this.moduleLabels.singular)
        },
        message: '',
        emoji: '📄'
      };
    },
    disableUnpublished() {
      return this.relationshipField && apos.modules[this.relationshipField.withType].localized;
    },
    selectAllChoice() {
      const checkCount = this.checked.length;
      const pageNotFullyChecked = this.items
        .some((item) => !this.checked.includes(item._id));

      return {
        value: 'checked',
        indeterminate: checkCount && pageNotFullyChecked
      };
    }
  },
  created() {
    const DEBOUNCE_TIMEOUT = 500;
    this.onSearch = debounce(this.search, DEBOUNCE_TIMEOUT);

    this.moduleOptions.filters.forEach(filter => {
      this.filterValues[filter.name] = filter.def;
      if (!filter.choices) {
        this.queryExtras.choices = this.queryExtras.choices || [];
        this.queryExtras.choices.push(filter.name);
      }
    });
  },
  async mounted() {
    this.bindShortcuts();
    this.headers = this.computeHeaders();
    // Get the data. This will be more complex in actuality.
    this.modal.active = true;
    await this.getPieces();
    await this.getAllPiecesTotal();
    this.modal.triggerFocusRefresh++;

    this.currentChat = this.items?.[0]

    apos.bus.$on('content-changed', this.getPieces);
    apos.bus.$on('command-menu-manager-create-new', this.create);
    apos.bus.$on('command-menu-manager-close', this.confirmAndCancel);


    const config = await apos.http.get('apos-live-chat/config', {
      busy: true,
    })
    const connectionType = config.secure ? 'wss' : 'ws'
    const socket = io(`${connectionType}://${config.domain}:${config.port}`)
    this.socket = socket

    socket.emit("register", {
      userID: 'adminID',
      aposUserId: window.apos.login.user?._id
    });
    socket.userID = 'adminID'

    socket.on("private message", async ({ content, from, to }) => {
      console.log('=================> private message <=================', content)

      const index = this.items.findIndex(item => item.from === from);
      if (index > -1) {
        this.items[index].messages.push({
          content,
          sender: from,
          date: new Date().toISOString()
        })
      } else {
        await this.getPieces();
      }
      this.refreshKey++;
    });
  },
  unmounted() {
    this.destroyShortcuts();
    apos.bus.$off('content-changed', this.getPieces);
    apos.bus.$off('command-menu-manager-create-new', this.create);
    apos.bus.$off('command-menu-manager-close', this.confirmAndCancel);
  },
  methods: {
    handleChatUpdated(newMessage) {
      this.socket.emit(newMessage.type, newMessage.message);
      const index = this.items.findIndex(item => item.from === newMessage.message.to);
      if (index > -1) {
        this.items[index].messages.push({
          content: newMessage.message.content,
          sender: 'adminID',
          date: new Date().toISOString()
        })
        this.refreshKey++
      }
    },
    setCheckedDocs(checked) {
      this.checkedDocs = checked;
      this.checked = this.checkedDocs.map(item => {
        return item._id;
      });
    },
    async create() {
      await this.edit(null);
    },

    async edit(pieceOrId) {
      let piece;
      if ((typeof pieceOrId) === 'object') {
        piece = pieceOrId;
      } else if (pieceOrId) {
        piece = this.items.find(item => item._id === pieceOrId);
      } else {
        piece = null;
      }
      this.currentChat = piece
    },
    async finishSaved() {
      await this.getPieces();
    },
    async request(mergeOptions) {
      const options = {
        ...this.filterValues,
        ...this.queryExtras,
        ...mergeOptions,
        withPublished: 1
      };

      const type = this.relationshipField?.withType;
      const isPage = apos.modules['@apostrophecms/page'].validPageTypes
        .includes(type);

      if (isPage) {
        options.type = type;
      }

      // Avoid undefined properties.
      const qs = Object.entries(options)
        .reduce((acc, [key, val]) => ({
          ...acc,
          ...val !== undefined && { [key]: val }
        }), {});

      return apos.http.get(this.moduleOptions.action, {
        qs,
        busy: true,
        draft: true
      });
    },
    async getPieces() {
      if (this.holdQueries) {
        return;
      }

      this.holdQueries = true;

      const {
        currentPage, pages, results, choices
      } = await this.request({
        ...(
          this.moduleOptions.managerApiProjection &&
          { project: this.moduleOptions.managerApiProjection }
        ),
        page: this.currentPage
      });

      this.currentPage = currentPage;
      this.totalPages = pages;
      this.items = results;
      this.filterChoices = choices;
      this.holdQueries = false;
    },
    async getAllPiecesTotal() {
      const { count: total } = await this.request({ count: 1 });

      this.setAllPiecesSelection({
        isSelected: false,
        total
      });
    },
    async selectAllPieces() {
      const { results: docs } = await this.request({
        project: {
          _id: 1
        },
        attachments: false,
        perPage: this.allPiecesSelection.total
      });

      this.setAllPiecesSelection({
        isSelected: true,
        docs
      });
    },
    async updatePage(num) {
      if (num) {
        this.currentPage = num;
        await this.getPieces();
        this.currentChat = this.items?.[0]
      }
    },
    async search(query) {
      if (query) {
        this.queryExtras.autocomplete = query;
      } else if ('autocomplete' in this.queryExtras) {
        delete this.queryExtras.autocomplete;
      } else {
        return;
      }

      this.currentPage = 1;

      await this.getPieces();
      await this.getAllPiecesTotal();
    },
    async filter(filter, value) {
      if (this.filterValues[filter] === value) {
        return;
      }

      this.filterValues[filter] = value;
      this.currentPage = 1;

      await this.getPieces();
      await this.getAllPiecesTotal();
      this.headers = this.computeHeaders();

      this.setCheckedDocs([]);
    },
    shortcutNew(event) {
      const interesting = event.keyCode === 78; // N(ew)
      const topModal = apos.modal.stack[apos.modal.stack.length - 1] ? apos.modal.stack[apos.modal.stack.length - 1].id : null;
      if (
        interesting &&
        document.activeElement.tagName !== 'INPUT' &&
        this.$refs.modal.id === topModal
      ) {
        this.create();
      }
    },
    bindShortcuts() {
      window.addEventListener('keydown', this.shortcutNew);
    },
    destroyShortcuts() {
      window.removeEventListener('keydown', this.shortcutNew);
    },
    computeHeaders() {
      let headers = this.moduleOptions.columns || [];
      if (this.filterValues.archived) {
        headers = headers.filter(h => h.component !== 'AposCellLabels');
      }
      return headers;
    },
    async editRelationship(item) {
      const result = await apos.modal.execute('AposRelationshipEditor', {
        schema: this.relationshipField.schema,
        title: item.title,
        value: item._fields
      });
      if (result) {
        const index = this.checkedDocs.findIndex(_item => _item._id === item._id);
        this.checkedDocs.splice(index, 1, {
          ...this.checkedDocs[index],
          _fields: result
        });
      }
    },
    setAllPiecesSelection({
      isSelected, total, docs
    }) {
      if (typeof isSelected === 'boolean') {
        this.allPiecesSelection.isSelected = isSelected;
      }

      if (typeof total === 'number') {
        this.allPiecesSelection.total = total;
      }

      if (docs) {
        this.setCheckedDocs(docs);
      }
    },
    async handleBatchAction({
      label, action, requestOptions = {}, messages
    }) {
      if (action) {
        try {
          await apos.http.post(`${this.moduleOptions.action}/${action}`, {
            body: {
              ...requestOptions,
              _ids: this.checked,
              messages: messages,
              type: this.checked.length === 1 ? this.moduleLabels.singular
                : this.moduleLabels.plural
            }
          });
        } catch (error) {
          apos.notify('apostrophe:errorBatchOperationNoti', {
            interpolate: { operation: label },
            type: 'danger'
          });
          console.error(error);
        }
      }
    },
  },
};
</script>

<style lang="scss" scoped>
:deep(.apos-modal__body) {
  width: 50%;
}

:deep(.apos-modal__main) {
  overflow: hidden;
}

@media (max-width: 1048px) {
  :deep(.apos-manager-toolbar .apos-field--search) {
    width: auto;
  }
}
@media (max-width: 1620px) {
  :deep(.apos-manager-toolbar .apos-field--search) {
    width: 160px;
  }
  :deep([data-apos-test="archiveTrigger"]) {
    .apos-button__label {
      display: none;
    }
    .apos-button__icon {
      margin-right: 0;
    }
  }
}

.apos-pieces-manager__empty {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  margin-top: 130px;
}

.apos-pieces-manager__relationship__rail {
  padding: 20px;
}

.apos-pieces-manager__relationship__counts {
  margin-bottom: 20px;
}
</style>
