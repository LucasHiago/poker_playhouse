const _ = require('underscore')
const Seat = require('./seat.js')
const Deck = require('./deck.js')
const PokerHand = require('./pokerhand.js')

class Table {
  constructor(id, name, maxPlayers, limit) {
    this.id = parseInt(id)
    this.name = name
    this.maxPlayers = maxPlayers
    this.limit = limit
    this.players = []
    this.seats = this.initSeats(maxPlayers)
    this.board = []
    this.deck = null
    this.button = null
    this.turn = null
    this.pot = 0
    this.mainPot = 0
    this.callAmount = null
    this.minBet = this.limit / 200
    this.minRaise = this.limit / 100
    this.smallBlind = null
    this.bigBlind = null
    this.handOver = true
    this.winMessages = []
    this.wentToShowdown = false
  }
  initSeats(maxPlayers) {
    const seats = {}
    for (let i = 1; i <= maxPlayers; i++) {
      seats[i] = null
    }
    return seats
  }
  addPlayer(player) {
    this.players.push(player)
  }
  sitPlayer(player, seatId) {
    if (this.seats[seatId]) { return }
    this.seats[seatId] = new Seat(seatId, player, this.limit, this.limit)
    this.button = this.satPlayers().length === 1 ? seatId : this.button
  }
  standPlayer(socketId) {
    for (let i of Object.keys(this.seats)) {
      if (this.seats[i] && this.seats[i].player.socketId === socketId) {
        this.seats[i] = null
      }
    }

    if (this.satPlayers().length === 1) {
      this.endWithoutShowdown()
    }

    if (this.satPlayers().length === 0) {
      this.resetEmptyTable()
    }
  }
  removePlayer(socketId) {
    this.players = this.players.filter(player => player.socketId !== socketId)
    this.standPlayer(socketId)
  }
  findPlayerBySocketId(socketId) {
    for (let i = 1; i <= this.maxPlayers; i++) {
      if (this.seats[i] && this.seats[i].player.socketId === socketId) {
        return this.seats[i]
      }
    }
    throw new Error('seat not found!')
  }
  satPlayers() {
    return Object.values(this.seats).filter(seat => seat !== null)
  }
  nextSatPlayer(player, places) {
    let i = 0
    let current = player
    
    while (i < places) {
      current = current === this.maxPlayers ? 1 : current + 1
      if (this.seats[current]) i++
    }
    return current
  }
  unfoldedPlayers() {
    return Object.values(this.seats).filter(seat => seat !== null && !seat.folded)
  }
  nextUnfoldedPlayer(player, places) {
    let i = 0
    let current = player

    while (i < places) {
      current = current === this.maxPlayers ? 1 : current + 1
      let currentSeat = this.seats[current]

      if (currentSeat && !currentSeat.folded && currentSeat.stack > 0) i++
    }
    return current
  }
  startHand() {
    this.button = this.nextSatPlayer(this.button, 1)
    this.deck = new Deck()
    this.handOver = false
    this.wentToShowdown = false
    this.resetBoardAndPot()
    this.clearSeatHands()
    this.unfoldPlayers()
    this.resetBetsAndActions()
    this.setTurn()
    this.dealPreflop()
    this.setBlinds()
  }
  unfoldPlayers() {
    for (let i = 1; i <= this.maxPlayers; i++) {
      if (this.seats[i]) {
        this.seats[i].folded = false
      }
    }
  }
  setTurn() {
    this.turn = this.unfoldedPlayers().length <= 3 ?
      this.button : this.nextUnfoldedPlayer(this.button, 3)
  }
  setBlinds() {
    const isHeadsUp = this.unfoldedPlayers().length === 2 ? true : false
    
    this.smallBlind = isHeadsUp ?
      this.button : this.nextUnfoldedPlayer(this.button, 1)
    this.bigBlind = isHeadsUp ?
      this.nextUnfoldedPlayer(this.button, 1) : this.nextUnfoldedPlayer(this.button, 2)

    this.seats[this.smallBlind].placeBlind(this.minBet)
    this.seats[this.bigBlind].placeBlind(this.minBet * 2)
    
    this.pot += this.minBet * 3
    this.callAmount = this.minBet * 2
    this.minRaise = this.minBet * 4
  }
  clearSeats() {
    for (let i of Object.keys(this.seats)) {
      this.seats[i] = null
    }
  }
  clearSeatHands() {
    for (let i of Object.keys(this.seats)) {
      if (this.seats[i]) {
        this.seats[i].hand = []
      }
    }
  }
  clearSeatTurns() {
    for (let i of Object.keys(this.seats)) {
      if (this.seats[i]) {
        this.seats[i].turn = false
      }
    }
  }
  clearWinMessages() {
    this.winMessages = []
  }
  endHand() {
    this.clearSeatTurns()
    this.handOver = true
  }
  endWithoutShowdown() {
    const winner = this.unfoldedPlayers()[0]
    winner && winner.winHand(this.pot)
    this.winMessages.push(`${winner.player.name} wins $${this.pot.toFixed(2)}`)
    this.endHand()
  }
  resetEmptyTable() {
    this.button = null
    this.turn = null
    this.handOver = true
    this.deck = null
    this.wentToShowdown = false
    this.resetBoardAndPot()
    this.clearWinMessages()
    this.clearSeats()
  }
  resetBoardAndPot() {
    this.board = []
    this.pot = 0
    this.mainPot = 0
  }
  changeTurn(lastTurn) {
    if (this.unfoldedPlayers().length === 1) {
      this.endWithoutShowdown()
      return
    }

    if (this.allAllIn()) {
      while (this.board.length < 5 && !this.handOver) {
        this.dealNextStreet()
      }
    }

    if (this.allCheckedOrCalled()) {
      this.dealNextStreet()
      this.turn = this.handOver ? null : this.nextUnfoldedPlayer(this.button, 1)
    } else {
      this.turn = this.nextUnfoldedPlayer(lastTurn, 1)
    }

    for (let i = 1; i <= this.maxPlayers; i++) {
      if (this.seats[i]) {
        this.seats[i].turn = i === this.turn ? true : false
      }
    }
  }
  allCheckedOrCalled() {
    if (
      this.seats[this.bigBlind].bet === this.limit / 100 &&
      !this.seats[this.bigBlind].checked &&
      this.board.length === 0
    ) {
      return false
    }

    for (let i of Object.keys(this.seats)) {
      const seat = this.seats[i]
      if (seat && !seat.folded && seat.stack > 0) {
        if (
          (this.callAmount && seat.bet.toFixed(2) !== this.callAmount.toFixed(2)) ||
          (!this.callAmount && !seat.checked)
        ) {
          return false
        }
      }
    }
    return true
  }
  allAllIn() {
    for (let i of Object.keys(this.seats)) {
      if (this.seats[i] && this.seats[i].stack > 0) {
        return false
      }
    }
    return true
  }
  dealNextStreet() {
    const length = this.board.length
    this.resetBetsAndActions()
    this.mainPot = this.pot
    if (length === 0) {
      this.dealFlop()
    } else if (length === 3 || length === 4) {
      this.dealTurnOrRiver()
    } else if (length === 5) {
      this.determineWinner()
    }
  }
  determineWinner() {
    let winners = []
    let highScore = 0

    for (let i = 1; i <= this.maxPlayers; i++) {
      if (this.seats[i]) {
        const hand = PokerHand.score(this.seats[i].hand, this.board)

        if (hand.value > highScore) {
          winners = [[i, hand]]
          highScore = hand.value
        } else if (hand.value === highScore) {
          winners.push([i, hand])
        }
      }
    }

    for (let i = 0; i < winners.length; i++) {
      const seat = this.seats[winners[i][0]]
      const hand = winners[i][1]
      const winAmount = this.pot / winners.length

      seat.winHand(winAmount)
      this.winMessages.push(`${seat.player.name} wins $${winAmount.toFixed(2)} with ${hand.name}`)
    }

    this.wentToShowdown = true
    this.endHand()
  }
  resetBetsAndActions() {
    for (let i = 1; i <= this.maxPlayers; i++) {
      if (this.seats[i]) {
        this.seats[i].bet = 0
        this.seats[i].checked = false
        this.seats[i].lastAction = null
      }
    }
    this.callAmount = null
    this.minRaise = this.limit / 200
  }
  dealPreflop() {
    const arr = _.range(1, this.maxPlayers + 1)
    const order = arr.slice(this.button).concat(arr.slice(0, this.button))

     // deal cards to seated players
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < order.length; j++) {
        const seat = this.seats[order[j]]
        if (seat) {
          seat.hand.push(this.deck.draw())
          seat.turn = order[j] === this.turn ? true : false
        }
      }
    }
  }
  dealFlop() {
    for (let i = 0; i < 3; i++) {
      this.board.push(this.deck.draw())
    }
  }
  dealTurnOrRiver() {
    this.board.push(this.deck.draw())
  }
  handleFold(socketId) {
    let seat = this.findPlayerBySocketId(socketId)
    seat.fold()

    return {
      seatId: seat.id,
      message: `${seat.player.name} folds`
    }
  }
  handleCall(socketId) {
    let seat = this.findPlayerBySocketId(socketId)
    let addedToPot = this.callAmount > seat.stack
      ? seat.stack - seat.bet
      : this.callAmount - seat.bet

    seat.callRaise(this.callAmount)
    this.pot += addedToPot

    return {
      seatId: seat.id,
      message: `${seat.player.name} calls $${addedToPot.toFixed(2)}`
    }
  }
  handleCheck(socketId) {
    let seat = this.findPlayerBySocketId(socketId)
    seat.check()

    return {
      seatId: seat.id,
      message: `${seat.player.name} checks`
    }
  }
  handleRaise(socketId, amount) {
    let seat = this.findPlayerBySocketId(socketId)
    let addedToPot = amount - seat.bet

    seat.raise(amount)
    this.pot += addedToPot

    this.minRaise = this.callAmount ?
      (this.callAmount + (seat.bet - this.callAmount) * 2) : seat.bet * 2
    this.callAmount = amount

    return {
      seatId: seat.id,
      message: `${seat.player.name} raises to $${amount.toFixed(2)}`
    }
  }
}

module.exports = Table