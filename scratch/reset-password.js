import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.production' });
const uri = process.env.MONGO_URI;

// Define User schema inline to avoid ESM file loading complexities in script
const userSchema = new mongoose.Schema({
  email: String,
  password: { type: String }
});

userSchema.pre("save", async function(next) {
  if (!this.isModified("password") || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model('User', userSchema);

async function resetPassword() {
  console.log('Connecting to Production Database to reset password...');
  try {
    const conn = await mongoose.connect(uri);
    console.log('Connected!');

    const email = 'production_test@getzorah.com';
    const user = await User.findOne({ email });

    if (!user) {
      console.log('❌ User not found!');
      await mongoose.disconnect();
      return;
    }

    user.password = 'Password123!';
    await user.save();
    console.log('✅ Password successfully reset to: Password123!');

    await mongoose.disconnect();
    console.log('Disconnected!');
  } catch (err) {
    console.error('Error during password reset:', err.message);
  }
}

resetPassword();
