Component({
  options: {
    addGlobalClass: true,
  },

  properties: {
    text: { type: String, value: '' },
    icon: { type: String, value: '' },
    actionText: { type: String, value: '' },
  },

  methods: {
    onAction() {
      this.triggerEvent('action');
    },
  },
});
