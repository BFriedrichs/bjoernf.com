import React, { useState, useEffect, useCallback } from 'react';

import { upload } from 'app/api/admin';
import { getTags } from 'app/api/blog';
import { useRequest } from 'app/providers/RequestProvider';

import ControlPointIcon from 'app/components/icons/ControlPoint.svg';
import LoyaltyIcon from 'app/components/icons/Loyalty.svg';
import SubtitlesIcon from 'app/components/icons/Subtitles.svg';
import PostImage from 'app/components/PostImage';
import RichText from 'app/components/RichText';
import Tag from 'app/components/Tag';
import { IconButton } from 'app/components/ui/Button';
import TextField, { Autocomplete } from 'app/components/ui/TextField';

import './remirror.css';

const PostEditor = ({ post, updatePost }) => {
  const { sendRequest } = useRequest();
  const [newTag, setNewTag] = useState('');
  const [availableTags, setAvailableTags] = useState([]);

  useEffect(() => {
    sendRequest(getTags()).success(({ tags }) => {
      setAvailableTags(tags ?? []);
    });
  }, []);

  const {
    title = '',
    tags = [],
    html = '',
    image = '',
  } = { ...(post.published || {}), ...(post.draft || {}) };
  const [initialHtml] = useState(html);

  const uploadHandler = useCallback(
    (file, options) =>
      sendRequest(upload(post._id, file, options)).success(
        ({ src, fileName }) => {
          return Promise.resolve({ src, fileName });
        }
      ),
    [post._id]
  );

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-row items-center gap-4">
        <PostImage
          src={image}
          onImageChosen={(file, options) =>
            uploadHandler(file, options).then(({ src }) => {
              updatePost({ image: src });
            })
          }
          onImageCleared={() => {
            updatePost({ image: null });
          }}
          editable
        />
        <div className="flex flex-1 flex-col gap-7">
          <div className="flex flex-row flex-wrap items-center gap-4">
            <Autocomplete
              value={newTag}
              options={availableTags || []}
              onChange={(event) => setNewTag(event.target.value)}
              label="Add Tag"
              onKeyDown={(e) => {
                if (newTag === '' || tags?.includes(newTag)) {
                  return;
                }
                if (e.key === 'Enter') {
                  updatePost({ tags: [...(tags || []), newTag] });
                  setNewTag('');
                }
              }}
              icon={<LoyaltyIcon />}
            />
            <IconButton
              size="small"
              disabled={newTag === '' || tags?.includes(newTag)}
              onClick={() => {
                updatePost({ tags: [...(tags || []), newTag] });
                setNewTag('');
              }}
            >
              <ControlPointIcon />
            </IconButton>
            <div className="flex flex-1 flex-row flex-wrap gap-1">
              {tags?.map((t, i) => {
                return (
                  <Tag
                    key={t}
                    name={t}
                    onDelete={() => {
                      tags.splice(i, 1);
                      const newTags = [...tags];
                      updatePost({ tags: newTags });
                    }}
                  />
                );
              })}
            </div>
          </div>
          <TextField
            value={title}
            onChange={(event) => updatePost({ title: event.target.value })}
            label="Title"
            icon={<SubtitlesIcon />}
          />
        </div>
      </div>
      <RichText
        content={initialHtml}
        onChange={updatePost}
        upload={uploadHandler}
      />
    </div>
  );
};

export default PostEditor;
