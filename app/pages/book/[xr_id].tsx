import { BlitzPage } from "blitz"
import { getSessionContext } from "@blitzjs/server"
import Layout from "app/layouts/Layout"
import { useEffect, useState, useCallback, Fragment } from "react"
import Pusher from "pusher-js"
import * as PusherTypes from "pusher-js"
import { getAntiCSRFToken } from "blitz"
import _ from "lodash"
import { mapValues, pipe } from "remeda"

const hashCode = (s) => {
  return `${s}`.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0)
    return a & a
  }, 0)
}

const Circle = ({ view, users, ...rest }) => {
  const userList: User[] = pipe(
    users,
    mapValues((user) => ({ view: user.view, color: user.color })),
    Object.values
  )

  const UserCircle = ({ index, color }) => (
    <div
      style={{
        borderRadius: "100%",
        border: `1px solid ${color}`,
        height: `1.${index * 2}em`,
        width: `1.${index * 2}em`,
        position: "absolute",
        left: `calc(-0.${index}em - 1px)`,
        top: `calc(-0.${index}em - 1px)`,
      }}
    ></div>
  )

  return (
    <div
      {...rest}
      style={{
        borderRadius: "100%",
        border: "1px solid black",
        height: "1em",
        width: "1em",
        margin: "1em",
        position: "relative",
      }}
    >
      {userList.map(
        ({ view: userView, color }, index) =>
          view === userView && <UserCircle color={color} index={index + 1} key={color} />
      )}
    </div>
  )
}

type PageProps = {
  xr_id: string
  user_id: string
}

interface UserInfo {
  id: string
  email: string
}

interface User {
  id: string
  info: UserInfo
  color: string
  view: string
  top?: number
  left?: number
}

const views = ["Discussion", "Author", "Mind"]

const Book: BlitzPage<PageProps> = ({ xr_id, user_id: signedin_user_id }) => {
  const [pusherChannel, setPusherChannel] = useState<PusherTypes.PresenceChannel | null>(null)
  const [view, setView] = useState(views[0])
  const [users, setUsers] = useState<{ [name: string]: User }>({})
  const [size, setSize] = useState({ width: 0, height: 0 })

  const addMemberToUserList = useCallback(
    ({ id, info }) => {
      const { hashedPassword, ...rest_of_info } = info
      const color = `hsl(${hashCode(info.email) % 360},70%,60%)`
      setUsers((users) => ({ ...users, [`${id}`]: { id, info: rest_of_info, view, color } }))
    },
    [view]
  )

  //size
  useEffect(() => {
    const height = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.body.clientHeight
    )

    const width = Math.max(
      document.body.scrollWidth,
      document.body.offsetWidth,
      document.body.clientWidth
    )

    setSize({ width, height })
  }, [])

  // pusher registration
  useEffect(() => {
    const antiCSRFToken = getAntiCSRFToken()

    // Pusher.logToConsole = true
    const pusher = new Pusher("f9ad5b2d18011941ea45", {
      cluster: "eu",
      forceTLS: true,
      authEndpoint: `${process.env.NEXT_PUBLIC_HOST_URL}/api/auth`,
      auth: {
        headers: {
          "anti-csrf": antiCSRFToken,
        },
      },
    })

    const channel = pusher.subscribe(`presence-quickstart-${xr_id}`)

    //@ts-ignore
    setPusherChannel(channel)
  }, [xr_id])

  // subscription succeeded
  useEffect(() => {
    if (!pusherChannel) return

    pusherChannel.bind("pusher:subscription_succeeded", () => {
      // @ts-ignore
      pusherChannel.members.each((member) => {
        addMemberToUserList(member)
      })

      pusherChannel.bind("pusher:member_added", (member) => {
        addMemberToUserList(member)
      })

      pusherChannel.bind("pusher:member_removed", (member) => {
        setUsers((users) => {
          const { [member.id]: _removedUser, ...rest } = users
          return rest
        })
      })
    })
  }, [addMemberToUserList, pusherChannel])

  // pusher event listeners
  useEffect(() => {
    if (!pusherChannel) return

    pusherChannel.bind("client-view-change", ({ view }, { user_id }) => {
      setUsers((users) =>
        mapValues(users, (user) => (user.id === user_id ? { ...user, view } : user))
      )
    })

    pusherChannel.bind("client-mousemove", ({ x, y }, { user_id }) => {
      setUsers((users) =>
        mapValues(users, (user) =>
          user.id === user_id ? { ...user, left: x * size.width, top: y * size.height } : user
        )
      )
    })
  }, [pusherChannel, size])

  // cursor pusher trigger
  useEffect(() => {
    if (!pusherChannel) return
    const mouseListener = _.throttle((e) => {
      pusherChannel.trigger("client-mousemove", {
        x: e.pageX / size.width,
        y: e.pageY / size.height,
      })
    }, 125)

    document.addEventListener("mousemove", mouseListener)
    return () => document.removeEventListener("mousemove", mouseListener)
  }, [pusherChannel, size])

  // view pusher trigger
  useEffect(() => {
    if (!pusherChannel) return
    setUsers((users) =>
      mapValues(users, (user) => (user.id === `${signedin_user_id}` ? { ...user, view } : user))
    )
    pusherChannel && pusherChannel.trigger("client-view-change", { view })
  }, [view, pusherChannel, signedin_user_id])

  return (
    <div className="container">
      <main>
        <div id="user_list">
          {Object.values(users).map((user) => {
            return (
              <Fragment key={user.info.email}>
                {`${signedin_user_id}` === user.id || (
                  <span
                    className={`cursor-${user.id} cursor`}
                    style={{ left: user.left || 0, top: user.top || 0, color: user.color || "" }}
                  >
                    &#8598;{user.info.email.slice(0, 2)}
                  </span>
                )}
                <div id={`user_${user.id}`} style={{ backgroundColor: user.color }}>
                  {user.info.email}
                </div>
              </Fragment>
            )
          })}
        </div>

        <div style={{ border: "3px dotted black", padding: "3em" }}>{view}</div>
        <div style={{ margin: "2em", display: "flex" }}>
          {views.map((view) => (
            <Circle key={view} onClick={() => setView(view)} users={users} view={view} />
          ))}
        </div>
        <pre>{JSON.stringify(users, null, 2)}</pre>

        <div className="buttons" style={{ marginTop: "5rem" }}>
          <a
            className="button"
            href="https://github.com/blitz-js/blitz/blob/master/USER_GUIDE.md?utm_source=blitz-new&utm_medium=app-template&utm_campaign=blitz-new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
          <a
            className="button-outline"
            href="https://github.com/blitz-js/blitz"
            target="_blank"
            rel="noopener noreferrer"
          >
            Github Repo
          </a>
          <a
            className="button-outline"
            href="https://slack.blitzjs.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Slack Community
          </a>
        </div>
      </main>

      <footer>
        <a
          href="https://blitzjs.com?utm_source=blitz-new&utm_medium=app-template&utm_campaign=blitz-new"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by Blitz.js
        </a>
      </footer>

      <style jsx global>{`
        html,
        body {
          padding: 0;
          margin: 0;
          font-family: "Libre Franklin", -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
            Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
        }

        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          box-sizing: border-box;
        }
        .container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        main {
          padding: 5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        main p {
          font-size: 1.2rem;
        }

        p {
          text-align: center;
        }

        footer {
          width: 100%;
          height: 60px;
          border-top: 1px solid #eaeaea;
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: #45009d;
        }

        footer a {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        footer a {
          color: #f4f4f4;
          text-decoration: none;
        }

        .logo {
          margin-bottom: 2rem;
        }

        .logo img {
          width: 300px;
        }

        .buttons {
          display: grid;
          grid-auto-flow: column;
          grid-gap: 0.5rem;
        }
        .button {
          font-size: 1rem;
          background-color: #6700eb;
          padding: 1rem 2rem;
          color: #f4f4f4;
          text-align: center;
        }

        .button.small {
          padding: 0.5rem 1rem;
        }

        .button:hover {
          background-color: #45009d;
        }

        .button-outline {
          border: 2px solid #6700eb;
          padding: 1rem 2rem;
          color: #6700eb;
          text-align: center;
        }

        .button-outline:hover {
          border-color: #45009d;
          color: #45009d;
        }

        pre {
          background: #fafafa;
          border-radius: 5px;
          padding: 0.75rem;
        }
        code {
          font-size: 0.9rem;
          font-family: Menlo, Monaco, Lucida Console, Liberation Mono, DejaVu Sans Mono,
            Bitstream Vera Sans Mono, Courier New, monospace;
        }

        .grid {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;

          max-width: 800px;
          margin-top: 3rem;
        }

        @media (max-width: 600px) {
          .grid {
            width: 100%;
            flex-direction: column;
          }
        }
        body {
          margin: 1em;
        }
        #user_list div {
          margin-left: -12px;
          font-family: sans-serif;
          text-align: center;
          line-height: 40px;
          border-radius: 50%;
          border: 3px solid white;
          color: white;
          font-weight: bold;
        }
        .cursor {
          position: absolute;
        }
      `}</style>
    </div>
  )
}

Book.getLayout = (page) => <Layout title="Book">{page}</Layout>

export const getServerSideProps = async (ctx) => {
  const session = await getSessionContext(ctx.req, ctx.res)

  const params = ctx.params
  const xr_id: string = params.xr_id
  const props: PageProps = { xr_id, user_id: session.userId }
  return { props }
}

export default Book
