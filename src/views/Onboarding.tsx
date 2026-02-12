import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Moon, Sun } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
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
                // Handle no user - maybe anon auth or error
                console.error("No user found");
                // For now, let's just create a mock profile if no auth is set up
                // In real app, we'd force auth.
            } else {
                const { error } = await supabase.from('profiles').upsert({
                    id: user.id,
                    sleep_start: data.sleepStart,
                    sleep_end: data.sleepEnd
                });
                if (error) throw error;
            }

            // We'll call onComplete regardless for now to let user through
            // In production we'd want strict saving checks
            onComplete();

        } catch (error) {
            console.error('Error saving profile:', error);
            // Fallback for demo without backend
            onComplete();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex items-center justify-center p-4 bg-aurora-bg">
            <Card className="w-full max-w-sm border-aurora-primary/30">
                <CardHeader>
                    <CardTitle className="bg-gradient-to-r from-aurora-primary to-aurora-secondary bg-clip-text text-transparent text-center">
                        Welcome to Orbit
                    </CardTitle>
                    <p className="text-center text-aurora-muted text-sm mt-2">
                        Let's find your rhythm. When do you usually rest?
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Moon className="w-4 h-4 text-aurora-primary" />
                                Wait, I sleep at...
                            </label>
                            <Input
                                type="time"
                                defaultValue="23:00"
                                {...register('sleepStart', { required: true })}
                                className="bg-aurora-bg/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <Sun className="w-4 h-4 text-secondary" />
                                And I wake up at...
                            </label>
                            <Input
                                type="time"
                                defaultValue="07:00"
                                {...register('sleepEnd', { required: true })}
                                className="bg-aurora-bg/50"
                            />
                        </div>

                        <Button type="submit" className="w-full" isLoading={loading}>
                            Let's Go
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};
