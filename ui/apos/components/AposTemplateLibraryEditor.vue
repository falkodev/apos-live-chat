<template>
  <AposModal
    class="apos-doc-editor apos-template-doc-editor"
    :modal="modal"
    :modal-title="modalTitle"
    @inactive="modal.active = false"
    @show-modal="modal.showModal = true"
    @esc="confirmAndCancel"
    @no-modal="$emit('safe-close')"
  >
    <template #secondaryControls>
      <AposButton
        type="default"
        label="apostrophe:cancel"
        @click="confirmAndCancel"
      />
    </template>
    <template #primaryControls>
      <AposDocContextMenu
        v-if="original"
        :disabled="(errorCount > 0) || restoreOnly"
        :doc="original"
        :current="docFields.data"
        :published="published"
        :show-edit="false"
        @close="close"
      />
      <AposButton
        v-if="restoreOnly"
        type="primary"
        :label="saveLabel"
        :disabled="saveDisabled"
        :tooltip="errorTooltip"
        @click="onRestore"
      />
      <AposButtonSplit
        v-else-if="saveMenu"
        :menu="saveMenu"
        menu-label="Select Save Method"
        :disabled="saveDisabled"
        :tooltip="errorTooltip"
        :selected="savePreference"
        @click="saveHandler($event)"
      />
    </template>
    <template #leftRail>
      <AposModalRail>
        <AposModalTabs
          v-if="tabs.length"
          :key="tabKey"
          :current="currentTab"
          :tabs="tabs"
          :errors="fieldErrors"
          @select-tab="switchPane"
        />
      </AposModalRail>
    </template>
    <template #main>
      <AposModalBody>
        <template #bodyMain>
          <div
            v-if="docReady"
            class="apos-doc-editor__body"
          >
            <AposSchema
              v-for="tab in tabs"
              v-show="tab.name === currentTab"
              :ref="tab.name"
              :key="tab.name"
              :changed="changed"
              :schema="groups[tab.name].schema"
              :current-fields="groups[tab.name].fields"
              :trigger-validation="triggerValidation"
              :utility-rail="false"
              :following-values="followingValues('other')"
              :conditional-fields="conditionalFields"
              :doc-id="docId"
              :model-value="docFields"
              :server-errors="serverErrors"
              :generation="generation"
              @update:model-value="updateDocFields"
              @validate="triggerValidate"
            />
          </div>
        </template>
      </AposModalBody>
    </template>
    <template #rightRail>
      <AposModalRail type="right">
        <div class="apos-doc-editor__utility">
          <AposSchema
            v-if="docReady"
            ref="utilitySchema"
            :schema="groups['utility'].schema"
            :changed="changed"
            :current-fields="groups['utility'].fields"
            :trigger-validation="triggerValidation"
            :utility-rail="true"
            :following-values="followingUtils"
            :conditional-fields="conditionalFields"
            :doc-id="docId"
            :model-value="docFields"
            :modifiers="['small', 'inverted']"
            :server-errors="serverErrors"
            :generation="generation"
            @update:model-value="updateDocFields"
            @validate="triggerValidate"
          />
        </div>
      </AposModalRail>
    </template>
  </AposModal>
</template>

<script>
import { klona } from 'klona';
import AposModifiedMixin from 'Modules/@apostrophecms/ui/mixins/AposModifiedMixin';
import AposModalTabsMixin from 'Modules/@apostrophecms/modal/mixins/AposModalTabsMixin';
import AposEditorMixin from 'Modules/@apostrophecms/modal/mixins/AposEditorMixin';
import AposPublishMixin from 'Modules/@apostrophecms/ui/mixins/AposPublishMixin';
import AposArchiveMixin from 'Modules/@apostrophecms/ui/mixins/AposArchiveMixin';
import AposAdvisoryLockMixin from 'Modules/@apostrophecms/ui/mixins/AposAdvisoryLockMixin';
import AposDocErrorsMixin from 'Modules/@apostrophecms/modal/mixins/AposDocErrorsMixin';
import { detectDocChange } from 'Modules/@apostrophecms/schema/lib/detectChange';

export default {
  name: 'AposDocEditor',
  mixins: [
    AposModalTabsMixin,
    AposModifiedMixin,
    AposEditorMixin,
    AposPublishMixin,
    AposAdvisoryLockMixin,
    AposArchiveMixin,
    AposDocErrorsMixin
  ],
  provide () {
    return {
      originalDoc: this.originalDoc
    };
  },
  props: {
    moduleName: {
      type: String,
      required: true
    },
    docId: {
      type: String,
      required: false,
      default: null
    },
    type: {
      type: String,
      default: null
    },
    copyOfId: {
      type: String,
      default: null
    },
    saveAsTemplate: {
      type: Boolean,
      default: false
    }
  },
  emits: [ 'modal-result', 'safe-close' ],
  data() {
    return {
      docType: this.moduleName,
      docReady: false,
      fieldErrors: {},
      modal: {
        active: false,
        type: 'overlay',
        showModal: false
      },
      triggerValidation: false,
      original: null,
      originalDoc: {
        ref: null
      },
      published: null,
      readOnly: false,
      restoreOnly: false,
      saveMenu: null,
      generation: 0,
      selectedDocType: null,
      schemaHiddenFields: [
        'archived',
        'slug', // needed to prevent slugify loop when editing title
        'scheduledPublish',
        'scheduledUnpublish',
        ...(this.docId || this.copyOfId) ? [ 'type' ] : []
      ]
    };
  },
  computed: {
    schema() {
      const selectedDocTypeSchema = (this.selectedDocType?.schema || [])
        .filter((field) => !this.moduleOptions.schema.some(({ name }) => name === field.name))
        .map(field => field.name === 'slug'
          ? {
            ...field,
            page: this.docType === '@apostrophecms/page'
          }
          : field);

      const schema = ([ ...this.moduleOptions.schema, ...selectedDocTypeSchema ])
        .filter(field => {
          return apos.schema.components.fields[field.type] &&
            !this.schemaHiddenFields.includes(field.name);
        });

      if (this.restoreOnly || this.readOnly) {
        return schema.map((field) => ({
          ...field,
          readOnly: true
        }));
      }

      return schema;
    },
    getOnePath() {
      // Why would we ever "GET" the template using the original module?
      //
      // Answer: when we are copying a document that is not a template
      // ("save as").
      //
      // The rest of the time consulting moduleName can only confuse us because
      // it is a prop and we already know what we need to do.
      if (!this.docId && !this.copyOfId) {
        throw new Error('aposTemplateLibraryEditor: getOnePath: no docId or copyOfId');
      }

      const currentAction = this.docId || !this.saveAsTemplate
        ? apos.modules['@apostrophecms-pro/doc-template-library'].action
        : apos.modules[this.type].action;

      return `${currentAction}/${this.docId || this.copyOfId}`;
    },
    followingUtils() {
      return this.followingValues('utility');
    },
    canEdit() {
      if (this.original && this.original._id) {
        return this.original._edit || this.moduleOptions.canEdit;
      }

      return this.moduleOptions.canEdit;
    },
    canPublish() {
      if (this.original && this.original._id) {
        return this.original._publish || this.moduleOptions.canPublish;
      }

      return this.moduleOptions.canPublish;
    },
    canCreate() {
      return this.original &&
        !this.original._id &&
        this.moduleOptions.canCreate;
    },
    saveDisabled() {
      if (!this.canCreate && !this.canEdit) {
        return true;
      }
      if (this.restoreOnly) {
        // Can always restore if it's a read-only view of the archive
        return false;
      }
      if (this.errorCount) {
        // Always block save if there are errors in the modal
        return true;
      }
      if (!this.docId) {
        // If it is new you can always save it, even just to insert it with
        // defaults is sometimes useful
        return false;
      }
      if (this.isModified) {
        // If it has been modified in the modal you can always save it
        return false;
      }
      // If it is not manually published this is a simple "save" operation,
      // don't allow it since the doc is unmodified in the modal
      if (!this.manuallyPublished) {
        return true;
      }
      if (this.canPublish) {
        // Primary button is "publish". If it is previously published and the
        // draft is not modified since then, don't allow it
        return this.published && !this.isModifiedFromPublished;
      }
      if (!this.original) {
        // There is an id but no original — that means we're still loading the
        // original — block until ready
        return true;
      }
      // Contributor case. Button is "submit"
      // If previously published and not modified since, we can't submit
      if (this.published && !this.isModifiedFromPublished) {
        return true;
      }
      if (!this.original.submitted) {
        // Allow initial submission
        return false;
      }
      // Block re-submission of an unmodified draft (we already checked modified)
      return true;
    },
    moduleOptions () {
      const currentType = (this.docId || this.copyOfId) ? this.type : this.moduleName;
      return window.apos.modules[currentType] || {};
    },
    moduleAction () {
      // Use moduleName for the action since all page types use the
      // `@apostrophecms/page` module action.
      return (window.apos.modules[this.docType] || {}).action;
    },
    utilityFields() {
      let fields = [];
      if (this.groups.utility && this.groups.utility.fields) {
        fields = this.groups.utility.fields;
      }
      return this.filterOutParkedFields(fields);
    },
    modalTitle() {
      const isTypeSelected = this.docType !== this.moduleName;

      if (this.docId) {
        return {
          key: isTypeSelected ? 'aposTemplate:editTypeTemplate' : 'apostrophe:editType',
          type: this.$t(this.moduleOptions.label)
        };
      }

      return {
        key: isTypeSelected ? 'aposTemplate:newTypeTemplate' : 'apostrophe:newDocType',
        type: this.$t(isTypeSelected ? apos.modules[this.docType].label : this.moduleOptions.label)
      };
    },
    isModified() {
      if (!this.original) {
        return false;
      }
      return detectDocChange(this.schema, this.original, this.docFields.data);
    },
    isModifiedFromPublished() {
      if (!this.published) {
        return false;
      }
      return detectDocChange(this.schema, this.published, this.docFields.data);
    },
    savePreferenceName() {
      return `apos-${this.moduleName}-save-pref`;
    },
    savePreference() {
      let pref = window.localStorage.getItem(this.savePreferenceName);
      if (typeof pref !== 'string') {
        pref = null;
      }
      return pref;
    },
    saveLabel() {
      if (this.restoreOnly) {
        return 'apostrophe:restore';
      }
      if (this.docId && this.original?.lastPublishedAt) {
        return 'apostrophe:update';
      }

      return 'apostrophe:save';
    }
  },
  watch: {
    'docFields.data.type': {
      handler(newVal) {
        if (!this.selectedDocType || this.docType !== '@apostrophecms/page') {
          return;
        }
        if (this.selectedDocType.name !== newVal) {
          this.selectedDocType = apos.modules[newVal];
          this.prepErrors();
        }
      }
    },
    docType: {
      async handler() {
        await this.evaluateExternalConditions();
      }
    },
    // comes in late for pages
    manuallyPublished() {
      this.saveMenu = this.computeSaveMenu();
    },
    original(newVal) {
      this.originalDoc.ref = newVal;
      this.saveMenu = this.computeSaveMenu();
    }
  },
  async mounted() {
    this.modal.active = true;
    await this.evaluateExternalConditions();
    // After computed properties become available
    this.saveMenu = this.computeSaveMenu();
    this.cancelDescription = {
      key: 'apostrophe:discardChangesToDocTypePrompt',
      type: this.$t(this.moduleOptions.label)
    };
    if (this.docId) {
      await this.loadDoc();
      this.evaluateConditions();
      try {
        if (this.manuallyPublished) {
          this.published = await apos.http.get(this.getOnePath, {
            busy: true,
            qs: {
              archived: 'any',
              aposMode: 'published'
            }
          });
        }
      } catch (e) {
        if (e.name !== 'notfound') {
          await apos.notify('apostrophe:fetchPublishedVersionFailed', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
        }
      }
    } else {
      await this.$nextTick();
      await this.loadNewInstance();
      this.evaluateConditions();
    }

    apos.bus.$on('content-changed', this.onContentChanged);
  },
  unmounted() {
    apos.bus.$off('content-changed', this.onContentChanged);
  },
  methods: {
    initDocData(doc) {
      this.docType = doc.type;
      this.selectedDocType = apos.modules[doc.type];
      this.original = klona(doc);
      this.docFields.data = {
        ...this.getDefault(),
        ...doc,
        aposIsTemplate: true
      };

      if (!this.docId) {
        // Append " template" string to the title when creating a template from an existing doc
        this.docFields.data.title += ' template';
      }

      if (this.published) {
        this.changed = detectDocChange(this.schema, this.original, this.published, { differences: true });
      }

      this.prepErrors();
      this.docReady = true;
    },
    async saveHandler(action) {
      this.triggerValidation = true;
      this.$nextTick(async () => {
        if (this.savePreference !== action) {
          this.setSavePreference(action);
        }
        if (!this.errorCount) {
          this[action]();
        } else {
          this.triggerValidation = false;
          await apos.notify('apostrophe:resolveErrorsBeforeSaving', {
            type: 'warning',
            icon: 'alert-circle-icon',
            dismiss: true
          });
          this.focusNextError();
        }
      });
    },
    async loadDoc() {
      const [ docData, err ] = await this.getDoc();

      if (err) {
        await apos.notify('apostrophe:loadDocFailed', {
          type: 'warning',
          icon: 'alert-circle-icon',
          dismiss: true
        });
        await this.confirmAndCancel();
        return;
      }

      this.restoreOnly = docData.archived;
      const canEdit = docData._edit || this.moduleOptions.canEdit;
      this.readOnly = canEdit === false;
      if (canEdit && !await this.lock(this.getOnePath, this.docId)) {
        this.lockNotAvailable();
      }

      if (docData) {
        this.initDocData(docData);
      }
    },
    async getDoc() {
      try {
        const docData = await apos.http.get(this.getOnePath, {
          busy: true,
          qs: {
            archived: 'any'
          },
          draft: true
        });
        docData.aposIsTemplate = true;

        return [ docData ];
      } catch (err) {
        return [ null, err ];
      }
    },
    getDefault() {
      const doc = {};
      this.schema.forEach(field => {
        if (field.name.startsWith('_')) {
          return;
        }
        // Using `hasOwn` here, not simply checking if `field.def` is truthy
        // so that `false`, `null`, `''` or `0` are taken into account:
        const hasDefaultValue = Object.hasOwn(field, 'def');
        doc[field.name] = hasDefaultValue
          ? klona(field.def)
          : null;
      });
      return doc;
    },
    lockNotAvailable() {
      this.modal.showModal = false;
    },
    async onRestore() {
      await this.restore(this.original);
      await this.loadDoc();
    },
    async save() {
      const body = {
        ...this.docFields.data,
        aposIsTemplate: true,
        type: (this.docId && this.type) || (this.copyOfId && this.type) || this.selectedDocType?.name || this.docFields.data._type
      };

      const route = this.docId ? `${this.moduleAction}/${this.docId}` : this.moduleAction;
      const requestMethod = this.docId ? apos.http.put : apos.http.post;

      if (this.docId) {
        this.addLockToRequest(body);
      }

      let doc;
      try {
        await this.postprocess();
        doc = await requestMethod(route, {
          busy: true,
          body,
          _copyingId: this.copyOfId,
          draft: true
        });

        apos.bus.$emit('content-changed', {
          doc,
          action: this.docId ? 'update' : 'insert'
        });
      } catch (e) {
        if (this.isLockedError(e)) {
          await this.showLockedError(e);
          this.modal.showModal = false;
          return;
        } else {
          await this.handleSaveError(e, {
            fallback: 'An error occurred saving the document.'
          });
          return;
        }
      }
      this.$emit('modal-result', doc);
      this.modal.showModal = false;
      if (!this.docId && doc._url) {
        window.location = doc._url;
      }
    },
    async getNewInstance(type) {
      try {
        const body = {
          _newInstance: true,
          aposIsTemplate: true
        };

        const action = type ? apos.modules[type].action : this.moduleAction;
        const newDoc = await apos.http.post(action, {
          body,
          draft: true
        });
        newDoc.aposIsTemplate = true;
        return newDoc;
      } catch (error) {
        await apos.notify('apostrophe:errorCreatingNewContent', {
          type: 'danger',
          icon: 'alert-circle-icon',
          dismiss: true
        });

        console.error(`Error while creating new, empty content. Review your configuration for ${this.docType} (including \`type\` options in \`@apostrophecms/page\` if it's a page type).`);

        this.modal.showModal = false;
      }
    },
    async loadNewInstance() {
      const newInstance = this.copyOfId
        ? (await apos.http.get(this.getOnePath, {
          busy: true
        }))
        : await this.getNewInstance();
      if (this.copyOfId) {
        delete newInstance.parked;
        delete newInstance._id;
        delete newInstance._url;
        newInstance.title = `Copy of ${newInstance.title}`;
        newInstance.slug = newInstance.slug.replace(/([^@]+)$/, 'copy-of-$1');
        // For "Save As Template"
        newInstance.aposIsTemplate = true;
        // So the context menu knows
        newInstance._aposAutopublish = true;
      }

      this.original = newInstance;
      if (newInstance && newInstance.type !== this.docType) {
        this.docType = newInstance.type;
      }
      this.docFields.data = newInstance;
      const slugField = this.schema.find(field => field.name === 'slug');
      if (slugField) {
        // As a matter of UI implementation, we know our slug input field will
        // automatically change the empty string to the prefix, so to
        // prevent a false positive for this being considered a change,
        // do it earlier when creating a new doc.
        this.original.slug = this.original.slug || slugField.def || slugField.prefix || '';
      }
      this.prepErrors();
      this.docReady = true;
    },
    startNew() {
      this.modal.showModal = false;
      apos.bus.$emit('admin-menu-click', {
        itemName: `${this.moduleName}:editor`
      });
    },
    async selectDocType(type) {
      if (!type) {
        this.docType = this.moduleName;
        this.selectedDocType = null;
        return;
      }

      const newInstance = await this.getNewInstance(type);
      this.docType = type;
      this.selectedDocType = apos.modules[newInstance.type];

      const templateData = {
        title: this.docFields.data.title,
        _type: type,
        slug: this.docFields.data.slug,
        aposIsTemplate: this.docFields.data.aposIsTemplate
      };

      this.docFields.data = {
        ...newInstance,
        ...templateData
      };
    },
    async updateDocFields(value) {
      if (
        (value.data._type || value.data._type === null) &&
        value.data._type !== this.docFields.data._type
      ) {
        const docTypeValue = value.data._type === null ? null : value.data._type;
        await this.selectDocType(docTypeValue);
        this.prepErrors();
        return;
      }

      this.updateFieldErrors(value.fieldState);
      this.docFields.data = {
        ...this.docFields.data,
        ...value.data,
        aposIsTemplate: true
      };
      this.evaluateConditions();
    },
    getAposSchema(field) {
      return field.group.name === 'utility'
        ? this.$refs.utilitySchema
        : this.$refs[field.group.name][0];
    },
    filterOutParkedFields(fields) {
      return fields.filter(fieldName => {
        return !((this.original && this.original.parked) || []).includes(fieldName);
      });
    },
    computeSaveMenu () {
      // Powers the dropdown Save menu
      // all actions expected to be methods of this component
      // Needs to be manually computed because this.saveLabel doesn't stay reactive when part of an object
      const typeLabel = this.$t(this.moduleOptions
        ? this.moduleOptions.label
        : 'document');
      const description = {
        saveLabel: this.$t(this.saveLabel),
        typeLabel
      };

      return [
        {
          label: this.saveLabel,
          action: 'save',
          description: {
            ...description,
            key: !this.docId ? 'apostrophe:insertAndReturn' : 'apostrophe:updateAndReturn'
          },
          def: true
        }
      ];
    },
    setSavePreference(pref) {
      window.localStorage.setItem(this.savePreferenceName, pref);
    },
    onContentChanged({ doc, action }) {
      if (!doc || this.original?._id !== doc._id) {
        return;
      }
      if (doc.type && doc.type !== this.docType) {
        this.docType = doc.type;
      }
      this.docFields.data = doc;
      this.docFields.data.aposIsTemplate = true;
      this.generation++;

      if (
        action === 'archive' ||
        action === 'unpublish' ||
        action === 'delete' ||
        action === 'revert-draft-to-published'
      ) {
        this.modal.showModal = false;
      }
    },
    close() {
      this.modal.showModal = false;
    }
  }
};
</script>

<style lang="scss" scoped>
.apos-template-doc-editor {
  .apos-doc-editor__body {
    padding-top: $spacing-double;
  }

  .apos-doc-editor__utility {
    padding: $spacing-quadruple $spacing-base;
    @include media-up(lap) {
      padding: $spacing-quadruple $spacing-double;
    }
  }
}
</style>
