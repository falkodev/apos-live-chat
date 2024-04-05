module.exports = {
  improve: '@apostrophecms/user',

  fields: {
    add: {
      liveChatManager: {
        type: 'boolean',
        label: 'Live Chat Manager',
        help: 'Allow user to manage live chat messages',
        def: false,
      },
      liveChatClient: {
        type: 'boolean',
        label: 'Live Chat Client',
        help: 'Allow user to send live chat messages',
        def: true,
      },
    },
    group: {
      liveChat: {
        label: 'Live Chat',
        fields: [
          'liveChatManager',
          'liveChatClient',
        ],
      },
    },
  },

  extendMethods () {
    return {
      getBrowserData (_super, req) {
        const browserData = _super(req)

        return { ...browserData, liveChatManager: req?.user?.liveChatManager, liveChatClient: req?.user?.liveChatClient }
      },
    }
  },
}
