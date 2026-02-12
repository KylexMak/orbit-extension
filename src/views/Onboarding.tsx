import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Moon, Sun } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase } from '../lib/supabaseClient';

interface OnboardingProps {
    onComplete: () => void;
}

interface OnboardingForm {
    sleepStart: string;
    sleepEnd: string;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit } = useForm<OnboardingForm>();

    const onSubmit = async (data: OnboardingForm) => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                console.error("No user found");
            } else {
                const { error } = await supabase.from('profiles').upsert({
                    id: user.id,
                    sleep_start: data.sleepStart,
                    sleep_end: data.sleepEnd
                });
                if (error) throw error;
            }

            onComplete();

        } catch (error) {
            console.error('Error saving profile:', error);
            onComplete();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center">
            <div className="w-full max-w-sm">
                <div className="text-center mb-4">
                    <h3 className="text-xl font-semibold bg-gradient-to-r from-aurora-primary to-aurora-secondary bg-clip-text text-transparent">
                        Welcome to Orbit
                    </h3>
                    <p className="text-aurora-muted text-sm mt-1">
                        Let's find your rhythm. When do you usually rest?
                    </p>
                </div>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2 text-aurora-text">
                            <Moon className="w-4 h-4 text-aurora-primary" />
                            Wait, I sleep at...
                        </label>
                        <Input
                            type="time"
                            defaultValue="23:00"
                            {...register('sleepStart', { required: true })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2 text-aurora-text">
                            <Sun className="w-4 h-4 text-aurora-secondary" />
                            And I wake up at...
                        </label>
                        <Input
                            type="time"
                            defaultValue="07:00"
                            {...register('sleepEnd', { required: true })}
                        />
                    </div>

                    <Button type="submit" className="w-full" isLoading={loading}>
                        Save
                    </Button>
                </form>
            </div>
        </div>
    );
};
