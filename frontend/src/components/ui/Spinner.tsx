import { KLLoaderInline } from './KLLoader'

/**
 * Loading placeholder. All existing call sites pass only `text` which we drop
 * in favour of the Keeper League logo animation from static/style.css — it
 * matches the Jinja-side loader and looks considerably less 2002.
 */
export function Spinner(_props: { text?: string } = {}) {
  void _props
  return <KLLoaderInline />
}
