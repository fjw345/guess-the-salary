import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('用法: npm run admin:hash -w @guess-salary/api -- <密码>');
  process.exit(1);
}
console.log(await bcrypt.hash(password, 12));
