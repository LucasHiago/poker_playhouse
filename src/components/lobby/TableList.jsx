import React from 'react'
import Table from './Table'

class TableList extends React.Component {
  render() {
    const { tables, table, onTableClick } = this.props

    if (Object.keys(tables).length > 0) {
      return (
        <div>
          <h3>Games</h3>
          <table className="table-list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Stakes</th>
                <th>Players</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(tables).map((id) => {
                let active
                if (table) {
                  active = id == table.id ? true : false
                }

                return (
                  <Table
                    key={id}
                    table={tables[id]}
                    onTableClick={onTableClick} 
                    active={active}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )
    } else {
      return <div><h1>Games</h1></div>
    }
  }
}

export default TableList