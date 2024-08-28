<script>
  import { page } from "$app/stores";
</script>

<nav>
  <ul>
    <li class={$page.url.pathname == "/" ? "active" : ""}>
      <a href="/">normal upload</a>
    </li>
    <li
      class={$page.url.pathname.startsWith("/multipart-upload") ? "active" : ""}
    >
      <a href="/multipart-upload">multipart upload</a>
    </li>
  </ul>
</nav>
<slot />

<style>
  nav {
    display: flex;
    justify-content: center;
    margin: 1rem;
  }

  ul {
    display: flex;
    list-style: none;
    padding: 0;
  }

  li {
    margin: 0 1rem;
  }

  a {
    text-decoration: none;
    color: blue;
  }

  .active a {
    text-decoration: underline;
  }
</style>
