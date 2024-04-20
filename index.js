const fs = require('fs')
const path = require('path')
const { Server } = require('socket.io')

module.exports = {
  extend: '@apostrophecms/piece-type',

  bundle: {
    directory: 'modules',
    modules: getBundleModuleNames(),
  },

  options: {
    name: 'apos-live-chat',
    localized: false,
    quickCreate: false,
    autopublish: true,
    components: {
      managerModal: 'AposLiveChatManager',
    },
  },

  icons: {
    'forum-icon': 'Forum',
  },

  fields: {
    add: {
      messages: {
        type: 'array',
        label: 'Messages',
        fields: {
          add: {
            content: {
              type: 'string',
              label: 'Content',
            },
            sender: {
              type: 'string',
              label: 'Sender',
            },
            date: {
              type: 'string',
              label: 'Date',
            },
          },
        }
      },
    }
  },

  columns: {
    add: {
      messagesCount: {
        label: 'Messages',
        component: 'ColumnMessagesCount',
      }
    }
  },

  init (self) {
    self.config = {
      port: 3002,
      secure: process.NODE_ENV === 'production',
      domain: 'localhost',
      ...self.options.config,
    }

    const io = new Server(self.config.port, {
      connectionStateRecovery: {},
      cors: {
        origin: [new RegExp(self.config.domain)],
        methods: ['GET', 'POST'],
      },
    })

    const registered = new Set()
    const waitingList = {}
    const req = self.apos.task.getReq()
    io.on('connection', (socket) => {
      socket.on("private message", async ({ content, from, to }) => {
        console.log('=================> private message <=================', from, content)

        const chats = await self.find(req, {}).toArray()
        // console.log('chats', require('util').inspect(chats, { colors: true, depth: 1 }))
        const condition = from === 'adminID' ? to : from
        let existingChat = chats.find(chat => chat.from === condition)
        const date = new Date().toISOString()
        if (!existingChat) {
          existingChat = await self.insert(req, {
            title: date,
            slug: self.apos.util.slugify(from + ' ' + date),
            from,
            messages: [{ content, sender: from, date }],
          })
        } else {
          await self.update(req, {
            ...existingChat,
            messages: [
              ...existingChat.messages,
              { content, sender: from, date }
            ]
          })
        }

        if (from !== 'adminID') {
          await self.apos.notify(req, `New message received on conversation ${existingChat.title}`, {
            type: 'info',
          })
        }

        if (!registered.has(to)) {
          waitingList[to] = waitingList[to] || []
          waitingList[to].push({ content, from, to })
          return
        }

        socket.to(to).emit("private message", {
          content,
          from,
          to,
        });
      });

      socket.on('register', (data) => {
        if (data.aposUserId) {
          req.user = req.user || {}
          req.user._id = data.aposUserId
        }

        if (data.userID) {
          socket.join(data.userID)
          socket.userID = data.userID
          registered.add(data.userID)

          if (waitingList[data.userID]) {
            waitingList[data.userID].forEach(({ content, from, to }) => {
              io.to(data.userID).emit("private message", {
                content,
                from,
                to,
              });
            })
            delete waitingList[data.userID]
          }
        }
      })
    })
  },

  methods (self) {
    return {
      addToAdminBar () {
        self.apos.adminBar.add(
          `${self.name}:manager`,
          'apos live chat',
          {
            action: 'publish',
            type: self.__meta.name,
          },
          {
            icon: 'forum-icon',
            contextUtility: true,
            tooltip: 'aposTemplate:tooltip',
          },
        )
      },
    }
  },

  apiRoutes (self) {
    return {
      get: {
        '/apos-live-chat/config': function (req) {
          return self.config
        },
        '/apos-live-chat/messages': async function (req) {
          const conversation = await self.find(req, { from: req.query.userID }).toObject()
          return conversation?.messages || []
        },
      },
    }
  },
}

function getBundleModuleNames () {
  const source = path.join(__dirname, './modules/@apostrophecms')
  return fs.readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => `@apostrophecms/${dirent.name}`)
}
