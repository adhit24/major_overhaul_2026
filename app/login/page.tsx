import { login } from './actions';
import { LoginCard } from './LoginCard';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginCard error={error} loginAction={login} />;
}
