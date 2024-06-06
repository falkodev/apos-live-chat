import { io } from 'socket.io-client'

export default () => {
  apos.util.onReady(async () => {
    if (apos.scene === 'public' || (apos.scene === 'apos' && apos.user.liveChatClient)) {
      const aposTag = document.querySelector('body')
      const chatapp = document.createElement('div')
      chatapp.id = 'chat-app'
      chatapp.className = 't-popup'
      aposTag.appendChild(chatapp)

      const defaultConfig = {
        selector: '#chat-app',
        color: 'green',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" viewBox="0 0 24 24"><path fill="currentColor" d="M17 12V3a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v14l4-4h10a1 1 0 0 0 1-1m4-6h-2v9H6v2a1 1 0 0 0 1 1h11l4 4V7a1 1 0 0 0-1-1"/></svg>'
      }

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
      socket.on('private message', (message) => {
        message.sender = message.from
        message.date = new Date()
        addMessages([message])
      })
      const messages = await apos.http.get('apos-live-chat/messages', {
        qs: { userID },
        busy: true,
      })

      const { selector, style, icon } = { ...defaultConfig, ...config }

      const popup = document.querySelector(selector)
      popup.innerHTML = ''

      const iconDiv = document.createElement('div')
      iconDiv.className = 't-popup__icon'
      iconDiv.innerHTML = icon
      popup.appendChild(iconDiv)

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
      container.appendChild(content)

      const send = document.createElement('form')
      send.className = 't-popup__send'
      container.appendChild(send)

      const inputMessage = document.createElement('span')
      inputMessage.className = 't-popup__input'
      inputMessage.contentEditable = true
      send.appendChild(inputMessage)

      const sendButton = document.createElement('button')
      sendButton.className = 't-popup__button t-popup__button--send'
      sendButton.dataset.send = ''
      send.appendChild(sendButton)

      const sendIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      sendIcon.setAttribute('width', '20')
      sendIcon.setAttribute('height', '20')
      sendIcon.setAttribute('viewBox', '0 0 512 512')
      sendIcon.setAttribute('fill', '#000')
      sendIcon.innerHTML = '<path d="M16,464,496,256,16,48V208l320,48L16,304Z"/>'
      sendButton.appendChild(sendIcon)

      Object.assign(container.style, style.container)
      Object.assign(content.style, style.messages)
      Object.assign(sendButton.style, style.sendButton)
      Object.assign(sendIcon.style, style.sendIcon)
      Object.assign(inputMessage.style, style.input)
      Object.assign(popup.style, style.popup)

      addMessages(messages)

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

      sendButton.addEventListener('click', (evt) => {
        evt.preventDefault()
        evt.stopPropagation()

        const content = inputMessage.innerText
        if (!content) {
          return
        }
        let userID = localStorage.getItem('userID')
        if (!userID) {
          userID = Date.now().toString(36) + Math.random().toString(36).substr(2)
          localStorage.setItem('userID', userID)
        }
        console.log('socket ====> ', socket.userID)
        socket.emit('private message', {
          content,
          to: 'adminID',
          from: userID,
        })
        inputMessage.innerText = ''
        addMessages([{
          content,
          sender: userID,
          date: new Date(),
        }])
      })

      function addMessages (messages) {
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
      }
      // /**
      //  * Popup function
      //  * @param {array} messages - required
      //  * @param {Object} config
      //  * @param {{string}} config.selector
      //  * @param {{Object}} config.style
      //  */
      // function popup(messages, { selector, style }) {
      // }
    }
  })
}
