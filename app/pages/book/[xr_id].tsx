import { Link, BlitzPage } from "blitz"
import Layout from "app/layouts/Layout"
import logout from "app/auth/mutations/logout"
import { useCurrentUser } from "app/hooks/useCurrentUser"
import { Suspense, useEffect } from "react"
import Pusher from "pusher-js"
import { getAntiCSRFToken } from "blitz"
import _ from "lodash"

/*
 * This file is just for a pleasant getting started page for your new app.
 * You can delete everything in here and start from scratch if you like.
 */

const UserInfo = () => {
  const currentUser = useCurrentUser()
  if (currentUser) {
    return (
      <>
        <button
          className="button small"
          onClick={async () => {
            await logout()
          }}
        >
          Logout
        </button>
        <div>
          User id: <code>{currentUser.id}</code>
          <br />
          User role: <code>{currentUser.role}</code>
        </div>
      </>
    )
  } else {
    return (
      <>
        <Link href="/signup">
          <a className="button small">
            <strong>Sign Up</strong>
          </a>
        </Link>
        <Link href="/login">
          <a className="button small">
            <strong>Login</strong>
          </a>
        </Link>
      </>
    )
  }
}

type PageProps = {
  xr_id: string
}

const Home: BlitzPage<PageProps> = ({ xr_id }) => {
  // console.log({ xr_id })

  const code = useEffect(() => {
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

    const antiCSRFToken = getAntiCSRFToken()

    // Pusher.logToConsole = true
    const pusher = new Pusher("f9ad5b2d18011941ea45", {
      // Replace with 'key' from dashboard
      cluster: "eu", // Replace with 'cluster' from dashboard
      forceTLS: true,
      authEndpoint: `${process.env.NEXT_PUBLIC_HOST_URL}/api/auth`,
      auth: {
        headers: {
          "anti-csrf": antiCSRFToken,
        },
      },
    })

    const channel = pusher.subscribe(`presence-quickstart-${xr_id}`)

    const hashCode = (s) => {
      return `${s}`.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0)
        return a & a
      }, 0)
    }

    function addMemberToUserList({ id, info }) {
      const userEl = document.createElement("div")
      userEl.id = "user_" + id
      userEl.innerText = info.email
      document?.getElementById("user_list")?.appendChild(userEl)
      userEl.style.backgroundColor = `hsl(${hashCode(parseInt(id)) % 360},70%,60%)`
    }

    channel.bind("pusher:subscription_succeeded", () => {
      // @ts-ignore
      channel.members.each((member) => {
        addMemberToUserList(member)
        const span = document.createElement("span")
        span.innerHTML = `&#8598; ${member.info.email.slice(0, 2)}`
        span.className = `cursor-${member.id} cursor`
        document.body.appendChild(span)
      })

      channel.bind("client-mousemove", ({ x, y }, { user_id }) => {
        const cursor = document.querySelector(`.cursor-${user_id}`)

        // eslint-disable-next-line
        cursor
          ? //@ts-ignore
            (document.querySelector(`.cursor-${user_id}`).style.cssText = `left: ${
              x * width
            }px; top: ${y * height}px; color: hsl(${hashCode(parseInt(user_id)) % 360},70%,60%);`)
          : null
      })

      const mouseMove = (e) => {
        channel.trigger("client-mousemove", { x: e.pageX / width, y: e.pageY / height })
      }

      document.addEventListener("mousemove", _.throttle(mouseMove, 125))
    })

    channel.bind("pusher:member_added", (member) => {
      addMemberToUserList(member)
      const span = document.createElement("span")
      span.innerHTML = `&#8598; ${member.info.email.slice(0, 2)}`
      span.className = `cursor-${member.id} cursor`
      document.body.appendChild(span)
    })

    channel.bind("pusher:member_removed", (member) => {
      const userEl = document.getElementById("user_" + member.id)
      userEl?.parentNode?.removeChild(userEl)
      const cursorEl = document.querySelector(`.cursor-${member.id}`)
      console.log({ cursorEl, member })

      cursorEl?.parentNode?.removeChild(cursorEl)
    })
  }, [xr_id])

  return (
    <div className="container">
      <main>
        <div id="user_list"></div>

        <div className="logo">
          <img src="/logo.png" alt="blitz.js" />
        </div>
        <p>
          <strong>Congrats!</strong> Your app is ready, including user sign-up and log-in.
        </p>
        <div className="buttons" style={{ marginTop: "1rem", marginBottom: "5rem" }}>
          <Suspense fallback="Loading...">
            <UserInfo />
          </Suspense>
        </div>
        <p>
          <strong>
            To add a new model to your app, <br />
            run the following in your terminal:
          </strong>
        </p>
        <pre>
          <code>blitz generate all project name:string</code>
        </pre>
        <pre>
          <code>blitz db migrate</code>
        </pre>

        <p>
          Then go to{" "}
          <Link href="/projects">
            <a>/projects</a>
          </Link>
        </p>
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

Home.getLayout = (page) => <Layout title="Home">{page}</Layout>

export const getServerSideProps = async (context) => {
  const params = context.params
  const xr_id: string = params.xr_id
  const props: PageProps = { xr_id }
  return { props }
}

export default Home
