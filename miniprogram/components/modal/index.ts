Component({
  options: {
    addGlobalClass: true,
  },

  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
    cancelText: { type: String, value: '' },
    confirmText: { type: String, value: '' },
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    },

    onConfirm() {
      this.triggerEvent('confirm');
    },

    onCancel() {
      this.triggerEvent('cancel');
    },

    noop() {},
  },
});
