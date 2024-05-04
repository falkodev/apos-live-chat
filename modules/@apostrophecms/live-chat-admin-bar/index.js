module.exports = {
  improve: '@apostrophecms/admin-bar',

  extendMethods (self) {
    return {
      itemIsVisible (_super, req, item) {
        if (item.name === 'apos-live-chat') {
          return req.user.liveChatManager
        }

        return _super(req, item)
      },
    }
  },
}
