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
    // name: '@apostrophecms-pro/doc-template-library',
    // label: 'aposTemplate:label',
    // pluralLabel: 'aposTemplate:pluralLabel',
    // quickCreate: false,
    // showPermissions: true,
    // editRole: 'editor',
    // publishRole: 'editor',
    // autopublish: true,
    // seoFields: false,
    // openGraph: false,
    // i18n: {
    //   ns: 'aposTemplate',
    //   browser: true
    // },
    components: {
      managerModal: 'AposLiveChatManager',
      // editorModal: 'AposTemplateLibraryEditor'
    }
  },

  icons: {
    'forum-icon': 'Forum',
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
    io.on('connection', (socket) => {
      socket.on("private message", ({ content, from, to }) => {
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
        if (data.userID) {
          socket.join(data.userID)
          socket.userID = data.userID
          if (data.userID !== 'adminID') {
            registered.add(data.userID)
          }

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
// TODO: piece manager with button/link not leading to piece editor but to a modal with conversation
// -----------------------------------------------------------
// | conv 1 | display                                         |
// | conv 2 | messages                                        |
// | conv 3 | of focused                                      |
// | conv 4 | conversation                                    |
// | conv 5 | here                                            |
// -----------------------------------------------------------
