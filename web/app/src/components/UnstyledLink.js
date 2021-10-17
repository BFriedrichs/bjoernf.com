import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import styled from '@emotion/styled'

import { isSSR } from 'app/util'

const UnstyledLink = styled(Link)`
  &&& {
    display: flex;
    align-items: center;
    text-decoration: none;
    color: initial;
  }
`

const ConsiderSSR = ({ to, delay, ...props }) => {
  const timeout = useRef()

  if (typeof to !== 'string') {
    return <div {...props} />
  }

  return (
    <UnstyledLink
      to={(isSSR ? '/node' : '') + to}
      onClick={(e) => {
        if (timeout.current) {
          timeout.current = null
          return
        }
        if (!!delay) {
          const currTarget = e.currentTarget
          e.preventDefault()
          timeout.current = setTimeout(() => {
            currTarget.click()
          }, delay)
        }
      }}
      {...props}
    />
  )
}

export default ConsiderSSR