import { Component } from "inferno";
import { Link } from "inferno-router";
import { GetPostsResponse, LemmyHttp, PostView } from "lemmy-js-client";
import { InitialFetchRequest, RouteDataResponse } from "@utils/types";
import { setIsoData } from "@utils/app";
import { HtmlTags } from "@components/common/html-tags";
import { SiteSidebar } from "./site-sidebar";
import {
  EMPTY_REQUEST,
  HttpService,
  LOADING_REQUEST,
  RequestState,
  wrapClient,
} from "../../services/HttpService";
import { FirstLoadService, I18NextService } from "@services/index";
import { Spinner } from "@components/common/icon";
import { IRoutePropsWithFetch } from "@utils/routes";
import { RouteComponentProps } from "inferno-router/dist/Route";
import { getHttpBaseInternal } from "../../utils/env";
import { mdToHtml } from "@utils/markdown";
import { PictrsImage } from "@components/common/pictrs-image";
import { MomentTime } from "@components/common/moment-time";
import { hostname } from "@utils/helpers";
import { relTags } from "@utils/config";
import { isImage } from "@utils/media";
import { isBrowser } from "@utils/browser";
import type { Tag } from "lemmy-js-client";

interface NewsLandingState {
  newsPosts: RequestState<GetPostsResponse>;
  galleryPosts: RequestState<GetPostsResponse>;
  localTopPosts: RequestState<GetPostsResponse>;
  isIsomorphic: boolean;
}

const COMMUNITY_SHORTCUTS = [
  "news",
  "gallery",
  "tech",
  "talks",
  "club",
  "blogs",
] as const;

type NewsLandingData = RouteDataResponse<{
  newsPosts: GetPostsResponse;
  galleryPosts: GetPostsResponse;
  localTopPosts: GetPostsResponse;
}>;

type NewsLandingRouteProps = RouteComponentProps<Record<string, never>> &
  Record<string, never>;

export type NewsLandingFetchConfig = IRoutePropsWithFetch<
  NewsLandingData,
  Record<string, never>,
  Record<string, never>
>;

export class NewsLanding extends Component<
  NewsLandingRouteProps,
  NewsLandingState
> {
  private isoData = setIsoData<NewsLandingData>(this.context);

  state: NewsLandingState = {
    newsPosts: EMPTY_REQUEST,
    galleryPosts: EMPTY_REQUEST,
    localTopPosts: EMPTY_REQUEST,
    isIsomorphic: false,
  };

  constructor(props: any, context: any) {
    super(props, context);

    if (FirstLoadService.isFirstLoad) {
      const { newsPosts, galleryPosts, localTopPosts } = this.isoData.routeData;

      this.state = {
        newsPosts,
        galleryPosts,
        localTopPosts,
        isIsomorphic: true,
      };
    }
  }

  async componentWillMount() {
    if (!this.state.isIsomorphic && isBrowser()) {
      await this.fetchAll();
    }
  }

  static async fetchInitialData({
    headers,
  }: InitialFetchRequest): Promise<NewsLandingData> {
    const client = wrapClient(
      new LemmyHttp(getHttpBaseInternal(), { headers }),
    );

    const [newsPosts, galleryPosts, localTopPosts] = await Promise.all([
      client.getPosts({ community_name: "news", sort: "New", limit: 20 }),
      client.getPosts({ community_name: "gallery", sort: "Top", limit: 3 }),
      client.getPosts({ type_: "Local", sort: "Top", limit: 10 }),
    ]);

    return { newsPosts, galleryPosts, localTopPosts };
  }

  get documentTitle(): string {
    const siteName = this.isoData.siteRes.site_view.site.name;
    return `News - ${siteName}`;
  }

  render() {
    return (
      <div className="news-landing container-lg">
        <HtmlTags
          title={this.documentTitle}
          path={this.context.router.route.match.url}
        />
        {this.renderCommunityShortcuts()}
        <div className="row">
          <aside className="col-12 col-lg-3 mb-3">
            {this.renderSiteSidebar()}
          </aside>
          <div className="col-12 col-lg-9">
            <div className="row">
              <main className="col-12 col-xl-8 mb-3">
                {this.renderNewsPosts()}
              </main>
              <aside className="col-12 col-xl-4">
                {this.renderGalleryHighlights()}
                {this.renderLocalTopPosts()}
                {this.renderTagCloud()}
              </aside>
            </div>
          </div>
        </div>
      </div>
    );
  }

  private renderCommunityShortcuts() {
    return (
      <nav className="card border-secondary mb-3">
        <div className="card-body d-flex flex-wrap gap-2">
          {COMMUNITY_SHORTCUTS.map(shortcut => (
            <Link
              key={shortcut}
              to={`/c/${shortcut}`}
              className="btn btn-outline-secondary btn-sm text-uppercase"
            >
              {this.formatShortcut(shortcut)}
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  private formatShortcut(shortcut: string) {
    return shortcut.charAt(0).toUpperCase() + shortcut.slice(1);
  }

  private renderSiteSidebar() {
    const {
      site_view: { site, local_site },
      admins,
      all_languages,
      discussion_languages,
    } = this.isoData.siteRes;

    return (
      <SiteSidebar
        site={site}
        localSite={local_site}
        admins={admins}
        myUserInfo={this.isoData.myUserInfo}
        allLanguages={all_languages}
        siteLanguages={discussion_languages}
      />
    );
  }

  private renderNewsPosts() {
    switch (this.state.newsPosts.state) {
      case "loading":
        return (
          <div className="text-center py-5">
            <Spinner large />
          </div>
        );
      case "failed":
        return this.renderError(this.state.newsPosts.err, () =>
          this.fetchAll(),
        );
      case "success": {
        const posts = this.state.newsPosts.data.posts;

        if (posts.length === 0) {
          return (
            <div className="alert alert-info" role="alert">
              {I18NextService.i18n.t("no_posts")}
            </div>
          );
        }

        return (
          <div className="news-feed">
            {posts.map(post => this.renderNewsPost(post))}
          </div>
        );
      }
      default:
        return <></>;
    }
  }

  private renderGalleryHighlights() {
    return (
      <section className="card border-secondary mb-3">
        <header className="card-header">
          <h5 className="mb-0">Top Gallery Posts</h5>
        </header>
        <div className="card-body">{this.renderGalleryContent()}</div>
      </section>
    );
  }

  private renderGalleryContent() {
    switch (this.state.galleryPosts.state) {
      case "loading":
        return (
          <div className="text-center py-2">
            <Spinner />
          </div>
        );
      case "failed":
        return this.renderError(this.state.galleryPosts.err, () =>
          this.fetchAll(),
        );
      case "success": {
        const posts = this.state.galleryPosts.data.posts;

        if (!posts.length) {
          return (
            <div className="text-muted">
              {I18NextService.i18n.t("no_posts")}
            </div>
          );
        }

        return (
          <ul className="list-unstyled mb-0">
            {posts.map(post => (
              <li key={post.post.id} className="mb-3">
                {this.renderGalleryItem(post)}
              </li>
            ))}
          </ul>
        );
      }
      default:
        return <></>;
    }
  }

  private renderGalleryItem(postView: PostView) {
    const thumbnail = this.getImageUrl(postView) ?? postView.post.thumbnail_url;

    return (
      <div className="d-flex gap-2 align-items-start">
        {thumbnail && (
          <div className="flex-shrink-0">
            <Link to={`/post/${postView.post.id}`}>
              <PictrsImage
                src={thumbnail}
                alt={postView.post.alt_text}
                thumbnail
                nsfw={postView.post.nsfw || postView.community.nsfw}
              />
            </Link>
          </div>
        )}
        <div>
          <Link to={`/post/${postView.post.id}`} className="fw-semibold">
            {postView.post.name}
          </Link>
          <div className="text-muted small">
            {postView.post.score} · {postView.post.comments}{" "}
            {I18NextService.i18n.t("comments")}
          </div>
        </div>
      </div>
    );
  }

  private renderLocalTopPosts() {
    return (
      <section className="card border-secondary mb-3">
        <header className="card-header">
          <h5 className="mb-0">Top Local Posts</h5>
        </header>
        <div className="card-body">{this.renderLocalTopContent()}</div>
      </section>
    );
  }

  private renderLocalTopContent() {
    switch (this.state.localTopPosts.state) {
      case "loading":
        return (
          <div className="text-center py-2">
            <Spinner />
          </div>
        );
      case "failed":
        return this.renderError(this.state.localTopPosts.err, () =>
          this.fetchAll(),
        );
      case "success": {
        const posts = this.state.localTopPosts.data.posts.slice(0, 10);

        if (!posts.length) {
          return (
            <div className="text-muted">
              {I18NextService.i18n.t("no_posts")}
            </div>
          );
        }

        return (
          <ol className="list-unstyled mb-0">
            {posts.map(post => (
              <li key={post.post.id} className="mb-2">
                <Link to={`/post/${post.post.id}`} className="fw-semibold">
                  {post.post.name}
                </Link>
                <div className="text-muted small">{post.community.title}</div>
              </li>
            ))}
          </ol>
        );
      }
      default:
        return <></>;
    }
  }

  private renderTagCloud() {
    switch (this.state.localTopPosts.state) {
      case "loading":
        return (
          <section className="card border-secondary">
            <header className="card-header">
              <h5 className="mb-0">Tag Cloud</h5>
            </header>
            <div className="card-body text-center py-4">
              <Spinner />
            </div>
          </section>
        );
      case "failed":
        return (
          <section className="card border-secondary">
            <header className="card-header">
              <h5 className="mb-0">Tag Cloud</h5>
            </header>
            <div className="card-body">
              {this.renderError(this.state.localTopPosts.err, () =>
                this.fetchAll(),
              )}
            </div>
          </section>
        );
      case "success": {
        const tags = this.buildTagCloud(this.state.localTopPosts.data.posts);

        return (
          <section className="card border-secondary">
            <header className="card-header">
              <h5 className="mb-0">Tag Cloud</h5>
            </header>
            <div className="card-body">
              {tags.length ? (
                <div className="news-tag-cloud d-flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span
                      key={tag.name}
                      className="badge bg-secondary-subtle text-body"
                      style={{ "font-size": `${tag.size}rem` }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-muted">
                  {I18NextService.i18n.t("none_found")}
                </div>
              )}
            </div>
          </section>
        );
      }
      default:
        return <></>;
    }
  }

  private renderNewsPost(postView: PostView) {
    const {
      post: {
        id,
        name,
        url,
        body,
        alt_text,
        nsfw,
        published_at,
        updated_at,
        score,
        comments,
      },
      creator,
      community,
      tags,
    } = postView;

    const isMini = this.hasMiniTag(tags);
    const imageUrl = !isMini ? this.getImageUrl(postView) : undefined;

    return (
      <article key={id} className="card border-secondary mb-3">
        <div className="card-body">
          <h3 className="card-title h4">
            <Link to={`/post/${id}`} className="text-body">
              {name}
            </Link>
          </h3>
          <div className="text-muted small mb-3">
            by <Link to={`/u/${creator.name}`}>@{creator.name}</Link>
            {" · "}
            <MomentTime published={published_at} updated={updated_at} />
            {" · "}
            {score} points
            {" · "}
            {comments} {I18NextService.i18n.t("comments")}
          </div>
          {url && !isMini && !imageUrl && (
            <div className="mb-3">
              <a href={url} target="_blank" rel={relTags}>
                {hostname(url)}
              </a>
            </div>
          )}
          {imageUrl && (
            <div className="mb-3">
              <a
                href={url ?? imageUrl}
                target={url ? "_blank" : undefined}
                rel={url ? relTags : undefined}
              >
                <PictrsImage
                  src={imageUrl}
                  alt={alt_text}
                  nsfw={nsfw || community.nsfw}
                />
              </a>
            </div>
          )}
          {!isMini && body && (
            <div
              className="md-div"
              dangerouslySetInnerHTML={mdToHtml(body, () => this.forceUpdate())}
            />
          )}
        </div>
      </article>
    );
  }

  private renderError(err: Error, retry: () => Promise<void> | void) {
    return (
      <div className="alert alert-danger" role="alert">
        <div className="mb-2">{err.message}</div>
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={() => retry()}
        >
          Retry
        </button>
      </div>
    );
  }

  private hasMiniTag(tags: Tag[]): boolean {
    return tags.some(tag => {
      const tagName = (tag.display_name || tag.name || "").toLowerCase();
      return tagName === "mini";
    });
  }

  private getImageUrl(postView: PostView): string | undefined {
    if (postView.image_details?.link) {
      return postView.image_details.link;
    }

    const { url, thumbnail_url } = postView.post;

    if (url && isImage(url)) {
      return url;
    }

    if (thumbnail_url && isImage(thumbnail_url)) {
      return thumbnail_url;
    }

    return undefined;
  }

  private buildTagCloud(posts: PostView[]) {
    const counts = new Map<string, number>();

    for (const post of posts) {
      for (const tag of post.tags) {
        if (tag.deleted) continue;
        const label = (tag.display_name || tag.name || "").trim();
        if (!label) continue;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }

    const entries = Array.from(counts.entries());

    if (!entries.length) {
      return [] as Array<{ name: string; size: number }>;
    }

    const max = Math.max(...entries.map(([, count]) => count));
    const min = Math.min(...entries.map(([, count]) => count));

    const minSize = 0.85;
    const maxSize = 1.6;

    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => {
        const ratio = max === min ? 0.5 : (count - min) / (max - min);
        return {
          name,
          size: parseFloat((minSize + (maxSize - minSize) * ratio).toFixed(2)),
        };
      });
  }

  private async fetchAll() {
    this.setState({
      newsPosts: LOADING_REQUEST,
      galleryPosts: LOADING_REQUEST,
      localTopPosts: LOADING_REQUEST,
    });

    const [newsPosts, galleryPosts, localTopPosts] = await Promise.all([
      HttpService.client.getPosts({
        community_name: "news",
        sort: "New",
        limit: 20,
      }),
      HttpService.client.getPosts({
        community_name: "gallery",
        sort: "Top",
        limit: 3,
      }),
      HttpService.client.getPosts({ type_: "Local", sort: "Top", limit: 10 }),
    ]);

    this.setState({ newsPosts, galleryPosts, localTopPosts });
  }
}
