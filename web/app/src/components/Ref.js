import React from 'react'

import { Link as RouterLink, withRouter } from 'react-router-dom'
import { Link } from '@mui/material'
import { withTheme } from '@mui/styles'
import { TransitEnterexit } from '@mui/icons-material'

const LinkRender = withTheme(({ theme, external, href, ...props }) =>
  external ? (
    <Link color="primary" href={href} target="_blank" {...props} />
  ) : (
    <RouterLink
      style={{ color: theme.palette.primary.main }}
      to={href}
      {...props}
    />
  )
)

const Ref = ({ text, href }) => (
  <React.Fragment>
    {' '}
    <LinkRender external={href.slice(0, 1) !== '/'} href={href}>
      {text}
      <TransitEnterexit
        color="primary"
        sx={{
          marginLeft: 0,
          fontSize: '1rem',
          transform: 'rotate(180deg)',
        }}
      />
    </LinkRender>
  </React.Fragment>
)

export default withRouter(Ref)
