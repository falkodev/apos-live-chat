import { io } from 'socket.io-client'

export default () => {
  const aposTag = document.querySelector('body')
  const chatapp = document.createElement('div')
  chatapp.id = 'chat-app'
  chatapp.className = 't-popup'
  aposTag.appendChild(chatapp)

  const defaultConfig = {
    selector: '#chat-app',
    color: 'green',
  }

  apos.util.onReady(async () => {
    if (apos.scene === 'public') {
      let displayChat = true
      let manageChat = false
      if (apos?.modules?.['@apostrophecms/user']) {
        const user = apos.modules['@apostrophecms/user']
        if (!user.liveChatClient) {
          displayChat = false
        }
        if (user.liveChatManager) {
          displayChat = true
          manageChat = true
        }
      }

      if (displayChat) {
        const config = await apos.http.get('apos-live-chat/config', {
          busy: true,
        })
        const connectionType = config.secure ? 'wss' : 'ws'
        const socket = io(`${connectionType}://${config.domain}:${config.port}`)
        localStorage.debug = '*';

        let userID = localStorage.getItem("userID");
        if (!userID) {
          userID = Date.now().toString(36) + Math.random().toString(36).substr(2);
          localStorage.setItem("userID", userID);
        }
        socket.emit("register", {
          userID
        });
        socket.userID = userID

        setTimeout(() => {
          console.log('socket ====> ', socket.userID)
          socket.emit("private message", {
            content: 'first private message',
            to: 'adminID',
            from: userID
          });
        }, 400)
        // setTimeout(() => {
        //   socket.emit("private message", {
        //     content: 'fourth private message',
        //     to: 'adminID',
        //     from: userID
        //   });
        // }, 2000)

        socket.on("private message", ({ content, from, to }) => {
          console.log('=================> private message <=================', content, from, to)
        });

        popup('chatapp', { ...defaultConfig, ...config })
      }
    }
  })
}

/**
 * Popup function
 * @param {string} message - required
 * @param {Object} buttons
 * @param {{label: string, action: function}} buttons.dismiss
 * @param {{label: string, action: function}} buttons.confirm
 */
function popup (message, { selector, color, confirm }) {
  const popup = document.querySelector(selector)
  popup.innerHTML = ''
  popup.style.borderColor = color

  const content = document.createElement('div')
  content.className = 't-popup__message'
  content.innerText = message
  popup.appendChild(content)

  const buttons = document.createElement('div')
  buttons.className = 't-popup__buttons'
  popup.appendChild(buttons)

  if (confirm) {
    if (confirm.label) {
      const confirmButton = document.createElement('button')
      confirmButton.className = 't-popup__button t-popup__button--confirm'
      confirmButton.dataset.confirm = ''
      confirmButton.innerText = confirm.label
      buttons.appendChild(confirmButton)

      if (confirm.action) {
        confirmButton.addEventListener('click', () => confirm.action())
      }
    }
  }

  const inputMessage = document.createElement('input')
  inputMessage.className = 't-popup__input'
  popup.appendChild(inputMessage)

  // document.body.addEventListener('click', (evt) => {
  //   const keepOpen = evt.target?.getAttribute('data-open-popup')
  //   if (!keepOpen) {
  //     popup.style.display = 'none'
  //   }
  // })

  popup.style.display = 'flex'
}
