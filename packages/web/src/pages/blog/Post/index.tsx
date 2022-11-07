import React, { useRef, useCallback, useState, Suspense } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toast';

import {
  updatePost as updatePostAPI,
  publishPost as publishPostAPI,
  unpublishPost as unpublishPostAPI,
  deletePost as deletePostAPI,
  deleteDraft as deleteDraftAPI,
} from 'src/api/admin';
import { getPost } from 'src/api/blog';
import { components } from 'src/api/schema';
import NotFound from 'src/pages/404';
import { useRequest } from 'src/providers/RequestProvider';
import { useSSR } from 'src/providers/SSRProvider';
import { isSSR } from 'src/util';

import FloatAside from 'src/components/FloatAside';
import { ReactComponent as DeleteIcon } from 'src/components/icons/Delete.svg';
import Alert from 'src/components/ui/Alert';
import Button from 'src/components/ui/Button';
import useDialog from 'src/components/ui/Dialog/useDialog';
import Skeleton from 'src/components/ui/Skeleton';
import Switch from 'src/components/ui/Switch';

const PostEditor = React.lazy(() => import('./PostEditor'));

import PostView from './PostView';

const filterEmpty = (dict: Record<string, any>): Record<string, any> =>
  !dict
    ? {}
    : Object.entries(dict)
        // eslint-disable-next-line no-unused-vars
        .filter(([, v]) => !!v)
        .reduce((p, [k, v]) => {
          p[k] = v;
          return p;
        }, {} as Record<string, any>);

const Post = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { token, sendRequest } = useRequest();

  const postId = params.id;

  if (!postId) {
    return <NotFound />;
  }

  const [loading, setLoading] = useState(true);
  const [isComparing, setIsComparing] = useState(false);
  const editing = location.pathname.endsWith('/edit') && !!token;
  const updateTimeout = useRef<NodeJS.Timeout>();
  const queuedUpdate = useRef<(then?: () => void) => void>();

  const { data: post, setData } = useSSR(getPost(postId), {
    chainFirst: () => setLoading(true),
    chainSuccess: (data) => {
      if (!isSSR) {
        const title = (data.post.published ?? data.post.draft).title;
        document.title = `${title} - Björn Friedrichs`;
      }
      return data.post;
    },
    chainFinally: () => setLoading(false),
    dataId: `post-${postId}`,
  });

  const updatePost = useCallback(
    (update: Partial<components['schemas']['PostContent']>) => {
      setData((prevPost) =>
        prevPost
          ? ({
              ...prevPost,
              draft: {
                ...filterEmpty(prevPost.published),
                ...filterEmpty(prevPost.draft),
                ...update,
              },
            } as components['schemas']['Post'])
          : null
      );

      if (updateTimeout.current) {
        clearTimeout(updateTimeout.current);
        updateTimeout.current = undefined;
      }

      const { title, tags, html, text, image } = update;
      queuedUpdate.current = (then?: () => void) => {
        sendRequest(
          updatePostAPI(postId, filterEmpty({ title, tags, html, text, image }))
        ).success(() => {
          toast.success('Post saved');
          if (then) {
            then();
          }
        });
      };

      updateTimeout.current = setTimeout(() => {
        if (queuedUpdate.current) {
          queuedUpdate.current();
        }
      }, 700);
    },
    [postId]
  );

  const publishPost = useCallback(() => {
    const doPublish = () => {
      sendRequest(publishPostAPI(postId))
        .success(({ post: updatedPost }) => {
          setData(updatedPost);
          navigate('#');
          toast.success('Post published');
        })
        .failure(() => {
          toast.error('Publish failed');
        });
    };

    if (queuedUpdate.current) {
      queuedUpdate.current(doPublish);
    } else {
      doPublish();
    }
  }, [postId]);

  const unpublishPost = useCallback(() => {
    sendRequest(unpublishPostAPI(postId))
      .success(({ post: updatedPost }) => {
        setData(updatedPost);
        toast.success('Post published');
      })
      .failure(() => {
        toast.error('Publish failed');
      });
  }, [postId]);

  const deletePost = useCallback(() => {
    sendRequest(deletePostAPI(postId))
      .success(() => {
        toast.success('Post deleted');
        navigate('/admin#tab-1');
      })
      .failure((e) => {
        toast.error(e.message);
      });
  }, [postId]);

  const deleteDraft = useCallback(() => {
    sendRequest(deleteDraftAPI(postId))
      .success(({ post }) => {
        toast.success('Draft deleted');
        setData(post);
      })
      .failure((e) => {
        toast.error(e.message);
      });
  }, [postId]);

  const [PublishDialog, openPublishDialog] = useDialog(
    'Are you sure you want to publish this post? This will make it available to the public.',
    publishPost
  );
  const [UnPublishDialog, openUnPublishDialog] = useDialog(
    'Are you sure you want to unpublish this post? Readers will be unable to access it.',
    unpublishPost
  );
  const [DeleteDialog, openDeleteDialog] = useDialog(
    'Are you sure you want to delete this post? This will remove it permanently.',
    deletePost
  );
  const [DeleteDraftDialog, openDeleteDraftDialog] = useDialog(
    'Are you sure you want to delete the draft for this post? This will remove it permanently.',
    deleteDraft
  );

  if (!post) {
    if (loading) {
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-row items-center justify-between">
            <Skeleton width={150} height={150} />
            <div className="flex flex-col gap-3">
              <Skeleton width={500} height={20} />
              <Skeleton width={500} height={40} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton width={600} height={10} />
            <Skeleton width={400} height={10} />
            <Skeleton width={500} height={10} />
            <Skeleton width={300} height={10} />
            <Skeleton width={500} height={10} />
            <Skeleton width={600} height={10} />
            <Skeleton width={500} height={10} />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton width={400} height={10} />
            <Skeleton width={400} height={10} />
            <Skeleton width={600} height={10} />
            <Skeleton width={600} height={10} />
            <Skeleton width={500} height={10} />
            <Skeleton width={600} height={10} />
          </div>
        </div>
      );
    }

    return <NotFound />;
  }

  const draftEqualsLive =
    !post.draft ||
    (post.draft?.html === post.published?.html &&
      post.draft?.title === post.published?.title &&
      post.draft?.image === post.published?.image &&
      post.draft?.tags?.length === post.published?.tags?.length);

  return (
    <FloatAside
      menu={
        token ? (
          <div className="flex flex-col gap-5">
            <PublishDialog />
            <UnPublishDialog />
            <DeleteDraftDialog />
            <DeleteDialog />
            <Alert severity={post.draft ? 'warning' : 'success'}>
              Status:{' '}
              {!post.published ? 'Draft' : `Version ${post.published.version}`}
              {post.published && post.draft ? ' (Changes)' : ''}
            </Alert>
            <div className="flex flex-row justify-center">
              <Switch
                checked={editing}
                onChange={() => {
                  navigate(`/blog/${post._id}/` + (!editing ? 'edit' : ''));
                }}
                label="Edit Mode"
              />
            </div>
            <div className="flex flex-row justify-center">
              <Switch
                disabled={!post.draft || !post.published}
                checked={isComparing}
                onChange={() => {
                  setIsComparing(!isComparing);
                }}
                label="Compare"
              />
            </div>
            <Button
              variant="contained"
              onClick={openPublishDialog}
              disabled={draftEqualsLive}
            >
              Publish
            </Button>
            {post?.published ? (
              <>
                <Button
                  disabled={draftEqualsLive}
                  variant="contained"
                  onClick={openDeleteDraftDialog}
                >
                  Discard changes
                </Button>
                <Button variant="contained" onClick={openUnPublishDialog}>
                  Un-publish
                </Button>
              </>
            ) : (
              <Button variant="contained" onClick={openDeleteDialog}>
                <DeleteIcon />
              </Button>
            )}
          </div>
        ) : null
      }
    >
      <div className="flex flex-col">
        <div className="flex flex-row gap-5">
          <div className="flex max-w-full flex-1 flex-col">
            {token && editing ? (
              <Suspense fallback={<div>Loading...</div>}>
                <PostEditor post={post} updatePost={updatePost} />
              </Suspense>
            ) : (
              <PostView
                postData={
                  isComparing || !post.published
                    ? { ...post.published, ...post.draft }
                    : { ...post.published }
                }
                createdAt={post.createdAt}
                hideShare={isComparing}
              />
            )}
          </div>
          {isComparing ? (
            <div className="flex flex-1 flex-col">
              <PostView
                postData={post.published}
                createdAt={post.createdAt}
                hideShare
              />
            </div>
          ) : null}
        </div>
      </div>
    </FloatAside>
  );
};

export default Post;