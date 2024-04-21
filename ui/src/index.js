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
        localStorage.debug = '*'

        let userID = localStorage.getItem('userID')
        if (!userID) {
          userID = Date.now().toString(36) + Math.random().toString(36).substr(2)
          localStorage.setItem('userID', userID)
        }
        socket.emit('register', {
          userID,
        })
        socket.userID = userID

        const messages = await apos.http.get('apos-live-chat/messages', {
          qs: { userID },
          busy: true,
        })

        // setTimeout(() => {
        //   console.log('socket ====> ', socket.userID)
        //   socket.emit("private message", {
        //     content: 'first private message',
        //     to: 'adminID',
        //     from: userID
        //   });
        // }, 400)
        // setTimeout(() => {
        //   socket.emit("private message", {
        //     content: 'fourth private message',
        //     to: 'adminID',
        //     from: userID
        //   });
        // }, 2000)

        socket.on('private message', ({ content, from, to }) => {
          console.log('=================> private message <=================', content, from, to)
        })

        popup(messages, { ...defaultConfig, ...config })
      }
    }
  })
}

/**
 * Popup function
 * @param {array} messages - required
 * @param {Object} buttons
 * @param {{label: string, action: function}} buttons.dismiss
 * @param {{label: string, action: function}} buttons.confirm
 */
function popup (messages, { selector, color, confirm }) {
  const popup = document.querySelector(selector)
  popup.innerHTML = ''

  const closeIcon = document.createElement('div')
  closeIcon.className = 't-popup__close'
  const icon1 = document.createElement('i')
  closeIcon.appendChild(icon1)
  const icon2 = document.createElement('i')
  closeIcon.appendChild(icon2)
  popup.appendChild(closeIcon)

  const container = document.createElement('div')
  container.className = 't-popup__container'
  popup.appendChild(container)

  const content = document.createElement('div')
  content.className = 't-popup__messages'

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    const messageDiv = document.createElement('div')
    messageDiv.className = 't-popup__message'

    const textDiv = document.createElement('div')
    textDiv.className = 't-popup__text'
    textDiv.innerText = message.content
    messageDiv.appendChild(textDiv)

    const messageDate = document.createElement('span')
    messageDate.className = 't-popup__date'
    messageDate.innerText = new Date(message.date).toLocaleDateString() + ' ' + new Date(message.date).toLocaleTimeString()
    messageDiv.appendChild(messageDate)

    if (message.sender !== 'adminID') {
      messageDiv.classList.add('t-popup__message--sender')
      textDiv.classList.add('t-popup__text--sender')
      messageDate.classList.add('t-popup__date--right')
    }

    content.appendChild(messageDiv)
  }
  container.appendChild(content)

  const buttons = document.createElement('div')
  buttons.className = 't-popup__buttons'
  container.appendChild(buttons)

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
  container.appendChild(inputMessage)

  popup.addEventListener('click', (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    popup.classList.add('t-popup--open')
  })

  closeIcon.addEventListener('click', (evt) => {
    evt.preventDefault()
    evt.stopPropagation()
    popup.classList.remove('t-popup--open')
  })
}
