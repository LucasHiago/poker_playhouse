import React from 'react'
import axios from 'axios'

class Login extends React.Component {
  componentDidMount() {
    const { socket } = this.props

    socket.on('lobby_joined', player => {
      this.props.router.push({
        pathname: '/lobby',
        state: { player }
      })
    })

    // socket.emit('join_lobby', (0|Math.random()*9e6).toString(36))
  }
  
  handleSubmit = e => {
    const { socket } = this.props
    e.preventDefault()
    
    const username = this.username.value
    const password = this.password.value
    if (!username || !password) { return }

    axios.post(`http://localhost:9000/api/signin`, { username, password })
      .then(response => {
        console.log(response)
      })
      .catch(error => {
        console.log(error)
      })

    // socket.emit('join_lobby', this.playerName.value)
  }

  render() {
    return (
      <div>
        <h1>Login</h1>
        <form onSubmit={this.handleSubmit}>
          <input
            type="text"
            placeholder="What's your name?"
            ref={ref => {this.username = ref}}
          />
          <input
            type="text"
            placeholder="password"
            ref={ref => {this.password = ref}}
          />
          <input
            type="submit"
            value="Login"
          />
        </form>
      </div>
    )
  }
}

export default Login
