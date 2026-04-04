<?php

namespace App\Filament\Resources;

use App\Filament\Resources\SkDocumentResource\Pages;
use App\Models\SkDocument;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;

class SkDocumentResource extends Resource
{
    protected static ?string $model = SkDocument::class;
    protected static ?string $navigationIcon = 'heroicon-o-document-text';
    protected static ?string $navigationLabel = 'SK Dokumen';
    protected static ?string $modelLabel = 'SK Dokumen';
    protected static ?int $navigationSort = 4;

    public static function form(Form $form): Form
    {
        return $form->schema([
            Forms\Components\Section::make('Data SK')->schema([
                Forms\Components\TextInput::make('nomor_sk')->label('Nomor SK')->required(),
                Forms\Components\Select::make('jenis_sk')->label('Jenis SK')
                    ->options([
                        'SK GTT' => 'SK GTT',
                        'SK GTY' => 'SK GTY',
                        'SK Tendik' => 'SK Tendik',
                        'SK Kepala Madrasah/ Sekolah PNS' => 'SK Kepala Madrasah/ Sekolah PNS',
                        'SK Kepala Madrasah/ Sekolah Non PNS' => 'SK Kepala Madrasah/ Sekolah Non PNS',
                        'SK PLT Kepala Madrasah/ Sekolah' => 'SK PLT Kepala Madrasah/ Sekolah',
                    ])->required(),
                Forms\Components\TextInput::make('nama')->required(),
                Forms\Components\TextInput::make('jabatan'),
                Forms\Components\TextInput::make('unit_kerja'),
                Forms\Components\TextInput::make('tanggal_penetapan')->required(),
                Forms\Components\Select::make('status')
                    ->options([
                        'draft' => 'Draft',
                        'pending' => 'Pending',
                        'approved' => 'Approved',
                        'rejected' => 'Rejected',
                        'active' => 'Active',
                    ])->default('draft'),
            ])->columns(2),

            Forms\Components\Section::make('Relasi')->schema([
                Forms\Components\Select::make('teacher_id')->label('Guru')
                    ->relationship('teacher', 'nama')->searchable()->preload(),
                Forms\Components\Select::make('school_id')->label('Sekolah')
                    ->relationship('school', 'nama')->searchable()->preload(),
            ])->columns(2),

            Forms\Components\Section::make('File & QR')->schema([
                Forms\Components\TextInput::make('file_url')->label('URL File'),
                Forms\Components\TextInput::make('surat_permohonan_url')->label('URL Surat Permohonan'),
            ])->columns(2),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('nomor_sk')->label('No. SK')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('nama')->searchable()->sortable(),
                Tables\Columns\TextColumn::make('jenis_sk')->label('Jenis')->badge(),
                Tables\Columns\TextColumn::make('unit_kerja')->searchable(),
                Tables\Columns\TextColumn::make('tanggal_penetapan')->label('Tanggal'),
                Tables\Columns\TextColumn::make('status')->badge()
                    ->color(fn(string $state): string => match($state) {
                        'draft' => 'gray',
                        'pending' => 'warning',
                        'approved', 'active' => 'success',
                        'rejected' => 'danger',
                        default => 'gray',
                    }),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options(['draft' => 'Draft', 'pending' => 'Pending', 'approved' => 'Approved', 'rejected' => 'Rejected', 'active' => 'Active']),
                Tables\Filters\SelectFilter::make('jenis_sk')->label('Jenis')
                    ->options([
                        'SK GTT' => 'SK GTT',
                        'SK GTY' => 'SK GTY',
                        'SK Tendik' => 'SK Tendik',
                        'SK Kepala Madrasah/ Sekolah PNS' => 'SK Kepala Madrasah/ Sekolah PNS',
                        'SK Kepala Madrasah/ Sekolah Non PNS' => 'SK Kepala Madrasah/ Sekolah Non PNS',
                        'SK PLT Kepala Madrasah/ Sekolah' => 'SK PLT Kepala Madrasah/ Sekolah',
                    ]),
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
                Tables\Actions\Action::make('approve')
                    ->label('Approve')
                    ->icon('heroicon-o-check-circle')
                    ->color('success')
                    ->visible(fn(SkDocument $record) => in_array($record->status, ['draft', 'pending']))
                    ->requiresConfirmation()
                    ->action(fn(SkDocument $record) => $record->update(['status' => 'approved'])),
                Tables\Actions\Action::make('reject')
                    ->label('Reject')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(fn(SkDocument $record) => in_array($record->status, ['draft', 'pending']))
                    ->requiresConfirmation()
                    ->action(fn(SkDocument $record) => $record->update(['status' => 'rejected'])),
            ])
            ->bulkActions([Tables\Actions\BulkActionGroup::make([Tables\Actions\DeleteBulkAction::make()])])
            ->defaultSort('created_at', 'desc');
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSkDocuments::route('/'),
            'create' => Pages\CreateSkDocument::route('/create'),
            'edit' => Pages\EditSkDocument::route('/{record}/edit'),
        ];
    }
}
