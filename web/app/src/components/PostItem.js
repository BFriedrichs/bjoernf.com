import React from 'react'

import { ListItem, ListItemButton } from '@mui/material'
import { PendingActions } from '@mui/icons-material'
import moment from 'moment'
import styled from '@emotion/styled'

import { morphMixin } from 'app/theme'
import { Row, Column } from 'app/components/Flex'
import { H4 } from 'app/components/Text'
import Tag from 'app/components/Tag'
import UnstyledLink from 'app/components/UnstyledLink'

const Title = styled(H4)`
  color: ${({ theme }) => theme.palette.primary.main};
`

const ShadowButton = styled(ListItemButton)`
  &&& {
    padding-bottom: 10px;
    padding-right: 10%;
    min-height: 77px;
    background-color: ${({ theme }) => theme.palette.background.default};

    ${morphMixin()}
  }
`

const Outer = styled(Row)`
  z-index: 5;
  overflow: hidden;

  @media only screen and (max-width: 425px) {
    overflow: visible;
    width: 100%;
    align-self: center;
  }
`

const Inner = styled(Row)`
  z-index: 5;
  padding: 15px 20px 0 25px;

  @media only screen and (max-width: 425px) {
    padding: 0;
    width: 100%;
  }
`

const PaperClip = styled(Row)`
  background-color: ${({ theme }) => theme.palette.background.default};
  z-index: 5;
  padding: 5px 10px;
  ${morphMixin()}
  border-radius: 10px 10px 0 0;

  @media only screen and (max-width: 425px) {
    padding: 5px 0;
    flex: 1;
    box-shadow: none;
  }
`

const Control = styled(Row)`
  @media only screen and (max-width: 425px) {
    flex-direction: column-reverse;
    padding-bottom: 8px;
    margin-top: 20px;
  }
`

const ClipOn = ({ children }) => (
  <Outer alignSelf="end">
    <Inner>
      <PaperClip>{children}</PaperClip>
    </Inner>
  </Outer>
)

const PostItem = ({ post }) => {
  const { draft, published, createdAt } = post
  const { title, tags } = draft ?? published
  const summary = draft ? draft.text?.slice(0, 100) : published.summary

  return (
    <Column>
      <Control justify="end">
        <Row gap={15} align="end">
          {tags
            ? tags.map((t) => (
                <Tag
                  style={{ zIndex: 10, paddingBottom: 6 }}
                  size="small"
                  key={t}
                  name={t}
                />
              ))
            : null}
        </Row>
        <ClipOn>
          <Row gap={10}>
            <Row>
              <span style={{ fontSize: '1rem' }}>
                {moment(createdAt * 1000).format('MMMM Do, YYYY')}
              </span>
            </Row>
          </Row>
        </ClipOn>
      </Control>
      <UnstyledLink delay={300} to={`/blog/${post._id}`}>
        <ListItem sx={{ padding: `0 0 10px 0` }}>
          <ShadowButton>
            <Row justify="start" flexed gap={10} grow={10} mobileWrapping>
              {draft ? <PendingActions /> : null}
              <Column gap={10}>
                <Title>{title || 'No title'}</Title>

                <span style={{ fontSize: '0.9em' }}>{summary}</span>
              </Column>
            </Row>
          </ShadowButton>
        </ListItem>
      </UnstyledLink>
    </Column>
  )
}

export default PostItem
