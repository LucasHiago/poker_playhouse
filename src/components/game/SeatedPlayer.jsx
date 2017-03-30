import React from 'react'
import Hand from './Hand'

class SeatedPlayer extends React.Component {
  render() {
    const { player, seat, isButton } = this.props

    return (
      <div>
        {seat.bet > 0 &&
          <div>${seat.bet.toFixed(2)}</div>  
        }
        
        {seat.hand.length > 0 && 
          <Hand seat={seat} />  
        }

        <div className="seat-info">
          <div className="seat-number">{seat.id}</div>
          <div className="seat-stack">
            <div>{seat.player.name} {player.socketId === seat.player.socketId ? '(me)' : ''} </div>
            <div> ${seat.stack.toFixed(2)}</div>
          </div>
        </div>

        {isButton && <span className="button">D</span>}
      </div>
    )
  }
}

export default SeatedPlayer
