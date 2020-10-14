import { getSessionContext } from "@blitzjs/server"
import * as Pusher from "pusher"
import db from "../../db/index"

const pusher = new Pusher.default({
  appId: `${process.env["APP_ID"]}`,
  key: `${process.env["KEY"]}`,
  secret: `${process.env["SECRET"]}`,
  cluster: `${process.env["CLUSTER"]}`,
  useTLS: true,
})

const route = async (req, res) => {
  const { userId } = await getSessionContext(req, res)

  const socketId = req.body.socket_id
  const channel = req.body.channel_name

  // Primitive auth: the client self-identifies. In your production app,
  // the client should provide a proof of identity, like a session cookie.
  const user = await db.user.findOne({ where: { id: userId } })

  const auth = pusher.authenticate(socketId, channel, {
    user_id: `${userId}`,
    // @ts-ignore
    user_info: { ...user },
  })

  res.send(auth)
}

export default route
